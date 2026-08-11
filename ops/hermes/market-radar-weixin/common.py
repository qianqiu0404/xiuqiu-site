"""Shared, model-free Weixin delivery primitives for the two radar outboxes."""

from __future__ import annotations

import asyncio
import json
import os
import re
import secrets
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from hermes_cli.config import cfg_get, load_config


DEFAULT_BASE_URL = "https://xiuqiu-site.vercel.app"
MAX_BODY_CHARS = 2800
PLUGIN_NAME = "market-radar-weixin"


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
    base_url = str(cfg_get(
        config, "plugins", "entries", PLUGIN_NAME, "config", "base_url", default=DEFAULT_BASE_URL,
    )).rstrip("/")
    shadow_mode = bool(cfg_get(
        config, "plugins", "entries", PLUGIN_NAME, "config", "shadow_mode", default=True,
    ))
    dispatch_token = (os.getenv("RADAR_DISPATCH_TOKEN") or os.getenv("MARKET_RADAR_DISPATCH_TOKEN") or "").strip()
    chat_id = os.getenv("WEIXIN_HOME_CHANNEL", "").strip()
    return base_url, dispatch_token, chat_id, shadow_mode


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


def post(url: str, token: str, payload: dict[str, Any]) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Radar API returned HTTP {exc.code}.") from exc


def check_health(base_url: str, path: str) -> None:
    request = urllib.request.Request(
        urllib.parse.urljoin(f"{base_url}/", path.lstrip("/")),
        headers={"Accept": "application/json,text/html", "User-Agent": "xiuqiu-hermes-radar/0.2"},
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        if response.status != 200:
            raise RuntimeError(f"Radar health check returned HTTP {response.status}.")


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
    if target.scheme != "https" or target.netloc != base.netloc or not target.path.startswith(page_prefix):
        raise DeliveryBlocked("page_url_invalid", "Published page URL is outside the configured radar boundary.")
    return urllib.parse.urlunparse(target)


def check_page(payload: dict[str, Any], base_url: str, page_prefix: str) -> str:
    page_url = safe_page_url(payload, base_url, page_prefix)
    request = urllib.request.Request(
        page_url,
        headers={"Accept": "text/html", "User-Agent": "xiuqiu-hermes-radar/0.2"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            html = response.read(250_000).decode("utf-8", errors="replace")
            if response.status != 200:
                raise DeliveryBlocked("page_not_ready", f"Published page returned HTTP {response.status}.")
    except urllib.error.HTTPError as exc:
        raise DeliveryBlocked("page_not_ready", f"Published page returned HTTP {exc.code}.") from exc
    except urllib.error.URLError as exc:
        raise DeliveryBlocked("page_network_error", "Published page could not be reached.") from exc
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
        payload["pageUrl"] = f"{spec.page_prefix}{date}"
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
    return Path.home() / ".hermes" / "state" / f"{spec.name}-deliveries.json"


def read_ledger(spec: RadarSpec) -> dict[str, dict[str, str]]:
    path = ledger_path(spec)
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def remember_delivery(spec: RadarSpec, key: str, message_id: str) -> None:
    path = ledger_path(spec)
    path.parent.mkdir(parents=True, exist_ok=True)
    ledger = read_ledger(spec)
    ledger[key] = {"providerMessageId": message_id, "sentAt": datetime.now(timezone.utc).isoformat()}
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        json.dump(ledger, handle, ensure_ascii=False, separators=(",", ":"))
        temporary = Path(handle.name)
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)


def remember_connection_test(message_id: str) -> None:
    path = Path.home() / ".hermes" / "state" / "radar-weixin-connection-test.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    value = {"confirmed": True, "providerMessageId": message_id, "sentAt": datetime.now(timezone.utc).isoformat()}
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        json.dump(value, handle, ensure_ascii=False, separators=(",", ":"))
        temporary = Path(handle.name)
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)


def pending_dir() -> Path:
    return Path.home() / ".hermes" / "state" / "radar-weixin-pending"


def store_pending_delivery(
    spec: RadarSpec,
    item: dict[str, Any],
    deliveries: list[dict[str, str]],
) -> str:
    directory = pending_dir()
    directory.mkdir(parents=True, exist_ok=True)
    now = time.time()
    for stale in directory.glob("*.json"):
        try:
            if now - stale.stat().st_mtime > 3600:
                stale.unlink()
        except OSError:
            pass
    reference = secrets.token_urlsafe(24)
    value = {
        "radar": spec.name,
        "itemId": str(item["id"]),
        "leaseToken": lease_token(item),
        "deliveries": deliveries,
    }
    path = directory / f"{reference}.json"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=directory, delete=False) as handle:
        json.dump(value, handle, ensure_ascii=False, separators=(",", ":"))
        temporary = Path(handle.name)
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)
    return reference


def load_pending_delivery(reference: str) -> dict[str, str] | None:
    if not re.fullmatch(r"[A-Za-z0-9_-]{20,80}", reference):
        return None
    path = pending_dir() / f"{reference}.json"
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None
    return value if isinstance(value, dict) else None


def remember_pending_failure(reference: str, error: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_-]{20,80}", reference):
        return
    path = pending_dir() / f"{reference}.json"
    if not path.is_file():
        return
    value = {"terminalError": str(error).strip()[:320] or "radar_delivery_failed"}
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        json.dump(value, handle, ensure_ascii=False, separators=(",", ":"))
        temporary = Path(handle.name)
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)


def forget_pending_delivery(reference: str) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_-]{20,80}", reference):
        return
    try:
        (pending_dir() / f"{reference}.json").unlink()
    except FileNotFoundError:
        pass


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
    """Claim at most one item and emit a credential-free gateway envelope."""
    base_url, dispatch_token, chat_id, shadow_mode = settings()
    if not dispatch_token:
        raise RuntimeError("RADAR_DISPATCH_TOKEN or MARKET_RADAR_DISPATCH_TOKEN is missing.")
    if not chat_id:
        raise RuntimeError("WEIXIN_HOME_CHANNEL is not configured.")
    if dry_run:
        await asyncio.to_thread(check_health, base_url, spec.health_path)
        print(json.dumps({"ready": True, "radar": spec.name, "outboxClaimed": False}, ensure_ascii=False))
        return 0
    claim = await asyncio.to_thread(
        post, f"{base_url}{spec.claim_path}", dispatch_token,
        {"leaseSeconds": 300, "kinds": list(spec.kinds)},
    )
    item = claim.get("item")
    if not item:
        print("[SILENT]")
        return 0

    payload = normalized_payload(item, spec)
    try:
        page_url = await asyncio.to_thread(check_page, payload, base_url, spec.page_prefix)
    except DeliveryBlocked as exc:
        await asyncio.to_thread(post, f"{base_url}{spec.ack_path}", dispatch_token, {
            "id": item["id"], "leaseToken": lease_token(item), "success": False,
            "errorCode": exc.code, "errorMessage": exc.safe_message,
        })
        print("[SILENT]")
        return 0

    key = logical_delivery_key(spec, item, payload)
    deliveries = []
    for alias in spec.recipient_aliases:
        delivery_key = key if len(spec.recipient_aliases) == 1 else f"{key}:{alias}"
        deliveries.append({
            "recipientAlias": alias,
            "idempotencyKey": delivery_key,
            "message": message(payload, page_url, spec, shadow_mode),
        })

    follow_up = payload.get("followUp")
    if str(item.get("kind") or "") == "daily" and isinstance(follow_up, dict):
        follow_key = str(follow_up.get("idempotencyKey") or "").strip()
        expected_key = f"market:quant:{payload.get('date', '')}"
        if spec.name != "market-radar" or follow_up.get("kind") != "quant" or follow_key != expected_key:
            raise RuntimeError("Market quant follow-up failed its idempotency boundary.")
        follow_page_url = await asyncio.to_thread(check_page, follow_up, base_url, spec.page_prefix)
        for alias in spec.recipient_aliases:
            deliveries.append({
                "recipientAlias": alias,
                "idempotencyKey": f"{follow_key}:{alias}",
                "message": message(follow_up, follow_page_url, spec, shadow_mode),
            })

    reference = store_pending_delivery(spec, item, deliveries)
    envelope = {"version": 1, "mode": "deliver", "deliveryRef": reference}
    print(json.dumps(envelope, ensure_ascii=False, separators=(",", ":")))
    return 0
