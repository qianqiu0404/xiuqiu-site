"""Shared, model-free Weixin delivery primitives for the two radar outboxes."""

from __future__ import annotations

import asyncio
import fcntl
import json
import os
import re
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from hermes_constants import get_hermes_home
from hermes_cli.config import cfg_get, load_config


PRODUCTION_BASE_URL = "https://xiuqiu-site.vercel.app"
MAX_BODY_CHARS = 2800
PLUGIN_NAME = "market-radar-weixin"
HTTP_RETRY_DELAYS = (0.5, 1.5)
TRANSIENT_HTTP_CODES = {408, 425, 429, 500, 502, 503, 504}
_LEDGER_LOCK = threading.RLock()


@dataclass(frozen=True)
class RadarSpec:
    name: str
    claim_path: str
    ack_path: str
    health_path: str
    page_prefix: str
    default_title: str
    footer: str
    kinds: tuple[str, ...]
    recipient_aliases: tuple[str, ...]


class DeliveryBlocked(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.safe_message = message


def settings() -> tuple[str, str, str, bool]:
    config = load_config()
    shadow_mode = bool(cfg_get(
        config, "plugins", "entries", PLUGIN_NAME, "config", "shadow_mode", default=True,
    ))
    dispatch_token = (os.getenv("RADAR_DISPATCH_TOKEN") or os.getenv("MARKET_RADAR_DISPATCH_TOKEN") or "").strip()
    chat_id = os.getenv("WEIXIN_HOME_CHANNEL", "").strip()
    return PRODUCTION_BASE_URL, dispatch_token, chat_id, shadow_mode


def local_delivery_options() -> tuple[str, float]:
    config = load_config()
    secondary_profile = str(cfg_get(
        config, "plugins", "entries", PLUGIN_NAME, "config", "secondary_profile", default="",
    )).strip()
    interval_value = cfg_get(
        config, "plugins", "entries", PLUGIN_NAME, "config", "delivery_interval_seconds", default=35,
    )
    try:
        interval = float(interval_value)
    except (TypeError, ValueError):
        interval = 35.0
    return secondary_profile, min(300.0, max(35.0, interval))


def _retry_delay(attempt: int) -> bool:
    if attempt >= len(HTTP_RETRY_DELAYS):
        return False
    time.sleep(HTTP_RETRY_DELAYS[attempt])
    return True


def post(url: str, token: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Perform one non-idempotent outbox mutation request.

    Claim and ACK endpoints change lease/attempt state.  A transport failure is
    therefore ambiguous and must never be retried by the client.  The server
    lease makes a later cron invocation safe.
    """
    if not url.startswith(f"{PRODUCTION_BASE_URL}/api/"):
        raise RuntimeError("Radar API URL is outside the production boundary.")
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=encoded,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "xiuqiu-hermes-radar/0.6",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            value = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Radar API returned HTTP {exc.code}.") from None
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError, json.JSONDecodeError):
        raise RuntimeError("Radar API transport unavailable.") from None
    if not isinstance(value, dict):
        raise RuntimeError("Radar API returned an invalid response.")
    return value


def check_health(base_url: str, path: str) -> None:
    if base_url != PRODUCTION_BASE_URL:
        raise RuntimeError("Radar health URL is outside the production boundary.")
    url = urllib.parse.urljoin(f"{base_url}/", path.lstrip("/"))
    for attempt in range(len(HTTP_RETRY_DELAYS) + 1):
        request = urllib.request.Request(
            url,
            headers={"Accept": "application/json,text/html", "User-Agent": "xiuqiu-hermes-radar/0.5"},
            method="GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                if response.status != 200:
                    raise RuntimeError(f"Radar health check returned HTTP {response.status}.")
                return
        except urllib.error.HTTPError as exc:
            if exc.code in TRANSIENT_HTTP_CODES and _retry_delay(attempt):
                continue
            raise RuntimeError(f"Radar health check returned HTTP {exc.code}.") from None
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError):
            if _retry_delay(attempt):
                continue
            raise RuntimeError("Radar health check transport unavailable after retries.") from None


def payload_for(item: dict[str, Any]) -> dict[str, Any]:
    payload = item.get("payload") or {}
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError:
            payload = {"body": payload}
    return payload if isinstance(payload, dict) else {}


def safe_page_url(payload: dict[str, Any], base_url: str, page_prefix: str) -> str:
    value = str(payload.get("pageUrl") or "").strip()
    if not value:
        raise DeliveryBlocked("page_url_missing", "Published page URL is missing.")
    base = urllib.parse.urlparse(base_url)
    target = urllib.parse.urlparse(urllib.parse.urljoin(f"{base_url}/", value))
    route_root = "/" + page_prefix.strip("/")
    if target.scheme != "https" or target.netloc != base.netloc or not (
        target.path == route_root or target.path.startswith(f"{route_root}/")
    ):
        raise DeliveryBlocked("page_url_invalid", "Published page URL is outside the configured radar boundary.")
    return urllib.parse.urlunparse(target)


def check_page(payload: dict[str, Any], base_url: str, page_prefix: str) -> str:
    page_url = safe_page_url(payload, base_url, page_prefix)
    html = ""
    for attempt in range(len(HTTP_RETRY_DELAYS) + 1):
        request = urllib.request.Request(
            page_url,
            headers={"Accept": "text/html", "User-Agent": "xiuqiu-hermes-radar/0.5"},
            method="GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                html = response.read(250_000).decode("utf-8", errors="replace")
                if response.status != 200:
                    raise DeliveryBlocked("page_not_ready", f"Published page returned HTTP {response.status}.")
                break
        except urllib.error.HTTPError as exc:
            if exc.code in TRANSIENT_HTTP_CODES and _retry_delay(attempt):
                continue
            raise DeliveryBlocked("page_not_ready", f"Published page returned HTTP {exc.code}.") from None
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError):
            if _retry_delay(attempt):
                continue
            raise DeliveryBlocked("page_network_error", "Published page could not be reached.") from None
    date = str(payload.get("date") or "").strip()
    if date and date not in html:
        raise DeliveryBlocked("page_date_missing", "Published page does not contain the expected date marker.")
    return page_url


def truncate_body(body: str) -> str:
    if len(body) <= MAX_BODY_CHARS:
        return body
    candidate = body[:MAX_BODY_CHARS]
    boundary = candidate.rfind("\n")
    if boundary >= MAX_BODY_CHARS // 2:
        candidate = candidate[:boundary]
    return f"{candidate.rstrip()}\n\n…更多内容请在网页查看。"


def normalized_payload(item: dict[str, Any], spec: RadarSpec) -> dict[str, Any]:
    payload = dict(payload_for(item))
    digest_id = str(payload.get("digestId") or "")
    date = str(payload.get("date") or "").strip()
    if not date:
        match = re.search(r"(?:daily-v\d+-)?(\d{4}-\d{2}-\d{2})", digest_id)
        if match:
            date = match.group(1)
            payload["date"] = date
    kind = str(item.get("kind") or "")
    if not payload.get("pageUrl") and kind == "daily" and date:
        payload["pageUrl"] = f"{spec.page_prefix.rstrip('/')}/{date}"
    if not payload.get("pageUrl") and spec.name == "market-radar" and payload.get("eventId"):
        payload["pageUrl"] = f"/market-radar/events/{payload['eventId']}"
    return payload


def message(payload: dict[str, Any], page_url: str, spec: RadarSpec, shadow_mode: bool) -> str:
    title = str(payload.get("title") or spec.default_title)
    if shadow_mode:
        title = f"【影子模式测试】{title}"
    body = truncate_body(str(payload.get("body") or payload.get("summary") or "").strip())
    source_url = str(payload.get("sourceUrl") or "").strip()
    source_urls = payload.get("sourceUrls") or []
    if not isinstance(source_urls, list):
        source_urls = []
    lines = [f"# {title}"]
    if body:
        lines.extend(["", body])
    if source_url:
        lines.extend(["", f"原始来源：{source_url}"])
    safe_sources = []
    for value in source_urls:
        parsed = urllib.parse.urlparse(str(value).strip())
        if parsed.scheme == "https" and parsed.netloc:
            safe_sources.append(urllib.parse.urlunparse(parsed))
    if safe_sources:
        lines.extend(["", "依据来源：", *(f"- {value}" for value in safe_sources[:8])])
    lines.extend(["", f"完整页面：{page_url}", "", spec.footer])
    return "\n".join(lines)


def ledger_path(spec: RadarSpec) -> Path:
    return get_hermes_home() / "state" / f"{spec.name}-deliveries.json"


def _load_ledger_unlocked(path: Path) -> dict[str, dict[str, str]]:
    try:
        raw = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return {}
    except OSError:
        raise RuntimeError("Radar delivery ledger is unavailable.") from None
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        raise RuntimeError("Radar delivery ledger is invalid.") from None
    if not isinstance(value, dict):
        raise RuntimeError("Radar delivery ledger is invalid.")
    return value


def read_ledger(spec: RadarSpec) -> dict[str, dict[str, str]]:
    path = ledger_path(spec)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock_path = path.with_suffix(path.suffix + ".lock")
    with _LEDGER_LOCK, lock_path.open("a+", encoding="utf-8") as lock_handle:
        os.chmod(lock_path, 0o600)
        fcntl.flock(lock_handle.fileno(), fcntl.LOCK_SH)
        try:
            return _load_ledger_unlocked(path)
        finally:
            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_UN)


def remember_delivery(spec: RadarSpec, key: str, message_id: str) -> None:
    path = ledger_path(spec)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock_path = path.with_suffix(path.suffix + ".lock")
    with _LEDGER_LOCK, lock_path.open("a+", encoding="utf-8") as lock_handle:
        os.chmod(lock_path, 0o600)
        fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX)
        try:
            ledger = _load_ledger_unlocked(path)
            ledger[key] = {"providerMessageId": message_id, "sentAt": datetime.now(timezone.utc).isoformat()}
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
                json.dump(ledger, handle, ensure_ascii=False, separators=(",", ":"))
                temporary = Path(handle.name)
            os.chmod(temporary, 0o600)
            os.replace(temporary, path)
        finally:
            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_UN)


def remember_connection_test(message_id: str) -> None:
    path = get_hermes_home() / "state" / "radar-weixin-connection-test.json"
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    value = {"confirmed": True, "providerMessageId": message_id, "sentAt": datetime.now(timezone.utc).isoformat()}
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        json.dump(value, handle, ensure_ascii=False, separators=(",", ":"))
        temporary = Path(handle.name)
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)


def logical_delivery_key(spec: RadarSpec, item: dict[str, Any], payload: dict[str, Any]) -> str:
    kind = str(item.get("kind") or "")
    date = str(payload.get("date") or "")
    event_id = str(payload.get("eventId") or "")
    if kind == "daily" and date:
        return f"{'market' if spec.name == 'market-radar' else 'learning'}:daily:{date}"
    if spec.name == "market-radar" and kind == "p0" and event_id:
        return f"market:p0:{event_id}"
    return str(item.get("idempotencyKey") or item.get("idempotency_key") or item.get("id") or "")


def acknowledged_delivery(spec: RadarSpec, item: dict[str, Any], payload: dict[str, Any]) -> str | None:
    key = logical_delivery_key(spec, item, payload)
    value = read_ledger(spec).get(key) or {}
    message_id = value.get("providerMessageId")
    return str(message_id) if message_id else None


def lease_token(item: dict[str, Any]) -> str:
    return str(item.get("leaseToken") or item.get("lease_token") or "")


def classify_weixin_error(value: Any) -> tuple[str, str]:
    if isinstance(value, dict):
        explicit = str(value.get("errorCode") or "").strip()
        safe_messages = {
            "recipient_not_configured": "Configured Weixin recipient is unavailable.",
            "weixin_rate_limited": "Weixin adapter reported rate limiting.",
            "weixin_cooldown_active": "Weixin adapter cooldown is active.",
            "weixin_not_configured": "Weixin credentials are not configured.",
            "weixin_auth_failed": "Weixin authentication failed.",
            "weixin_credentials_missing": "Weixin credentials are missing.",
            "weixin_not_connected": "Weixin adapter is not connected.",
            "provider_authentication_failed": "Weixin provider authentication failed.",
            "provider_auth_failed": "Weixin provider authentication failed.",
            "weixin_send_failed": "Weixin adapter did not confirm delivery.",
        }
        if explicit in safe_messages:
            message = safe_messages[explicit]
            try:
                retry_after = max(1, min(int(value.get("retryAfterSeconds")), 1800))
            except (TypeError, ValueError):
                retry_after = 0
            if retry_after and explicit in {"weixin_rate_limited", "weixin_cooldown_active"}:
                message = f"{message} Retry after {retry_after} seconds."
            return explicit, message
        value = value.get("error")
    lowered = str(value or "").lower()
    if "recipient_not_configured" in lowered:
        return "recipient_not_configured", "Configured Weixin recipient is unavailable."
    if "cooldown" in lowered or "rate" in lowered or "频" in lowered:
        return "weixin_rate_limited", "Weixin adapter reported rate limiting."
    return "weixin_send_failed", "Weixin adapter did not confirm delivery."


def connection_test_envelope() -> str:
    return json.dumps({
        "version": 1,
        "mode": "connection_test",
    }, ensure_ascii=False, separators=(",", ":"))


async def prepare(spec: RadarSpec, dry_run: bool) -> int:
    """Run one model-free dispatch entirely in this CLI process."""
    base_url, dispatch_token, chat_id, _ = settings()
    if not dispatch_token:
        raise RuntimeError("RADAR_DISPATCH_TOKEN or MARKET_RADAR_DISPATCH_TOKEN is missing.")
    if not chat_id:
        raise RuntimeError("WEIXIN_HOME_CHANNEL is not configured.")
    if dry_run:
        await asyncio.to_thread(check_health, base_url, spec.health_path)
        print(json.dumps({"ready": True, "radar": spec.name, "outboxClaimed": False}, ensure_ascii=False))
        return 0
    from .transport import dispatch_once

    outcome = await dispatch_once(spec, chat_id)
    print("[SILENT]")
    return 1 if outcome.infrastructure_error else 0
