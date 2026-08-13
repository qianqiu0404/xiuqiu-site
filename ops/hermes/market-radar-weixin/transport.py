"""Model-free, in-process claim-to-ACK radar delivery."""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from gateway.platforms.weixin import send_weixin_direct

from .common import (
    DeliveryBlocked,
    RadarSpec,
    check_page,
    classify_weixin_error,
    lease_token,
    local_delivery_options,
    logical_delivery_key,
    message,
    normalized_payload,
    post,
    read_ledger,
    remember_delivery,
    settings,
)


MAX_PREPARED_MESSAGE_CHARS = 5_000


@dataclass(frozen=True)
class DispatchOutcome:
    infrastructure_error: bool
    delivered: bool = False


def _monotonic() -> float:
    return time.monotonic()


async def _sleep(seconds: float) -> None:
    await asyncio.sleep(seconds)


def confirmed_provider_message_id(result: Any) -> str:
    """Accept only an explicit provider receipt, never our deterministic client id."""
    if not isinstance(result, dict) or not result.get("success") or result.get("error"):
        return ""
    message_id = str(result.get("providerMessageId") or "").strip()
    if not message_id or message_id.startswith("hermes-weixin-"):
        return ""
    return message_id


def _known_message_id(spec: RadarSpec, key: str) -> str:
    ledger = read_ledger(spec)
    value = ledger.get(key) or {}
    message_id = str(value.get("providerMessageId") or "")
    if message_id and not message_id.startswith("hermes-weixin-"):
        return message_id
    if key.endswith(":primary"):
        legacy = ledger.get(key.removesuffix(":primary")) or {}
        legacy_message_id = str(legacy.get("providerMessageId") or "")
        if legacy_message_id and not legacy_message_id.startswith("hermes-weixin-"):
            return legacy_message_id
    return ""


def _prepared_message(payload: dict[str, Any], page_url: str, spec: RadarSpec, shadow_mode: bool) -> str:
    content = message(payload, page_url, spec, shadow_mode)
    if not content.strip() or len(content) > MAX_PREPARED_MESSAGE_CHARS:
        raise DeliveryBlocked("message_size_invalid", "Prepared radar message failed its size boundary.")
    return content


async def _build_deliveries(
    spec: RadarSpec,
    item: dict[str, Any],
    base_url: str,
    shadow_mode: bool,
) -> list[dict[str, str]]:
    if str(item.get("kind") or "") not in spec.kinds:
        raise DeliveryBlocked("message_kind_invalid", "Claimed radar message kind is not allowed.")
    payload = normalized_payload(item, spec)
    page_url = await asyncio.to_thread(check_page, payload, base_url, spec.page_prefix)
    key = logical_delivery_key(spec, item, payload)
    if not key:
        raise DeliveryBlocked("idempotency_key_missing", "Radar delivery idempotency key is missing.")

    prepared = _prepared_message(payload, page_url, spec, shadow_mode)
    deliveries: list[dict[str, str]] = []
    for alias in spec.recipient_aliases:
        delivery_key = key if len(spec.recipient_aliases) == 1 else f"{key}:{alias}"
        deliveries.append({"recipientAlias": alias, "idempotencyKey": delivery_key, "message": prepared})

    follow_up = payload.get("followUp")
    if str(item.get("kind") or "") == "daily" and isinstance(follow_up, dict):
        follow_key = str(follow_up.get("idempotencyKey") or "").strip()
        expected_key = f"market:quant:{payload.get('date', '')}"
        if spec.name != "market-radar" or follow_up.get("kind") != "quant" or follow_key != expected_key:
            raise DeliveryBlocked("follow_up_invalid", "Market quant follow-up failed its idempotency boundary.")
        follow_page_url = await asyncio.to_thread(check_page, follow_up, base_url, spec.page_prefix)
        follow_message = _prepared_message(follow_up, follow_page_url, spec, shadow_mode)
        for alias in spec.recipient_aliases:
            deliveries.append({
                "recipientAlias": alias,
                "idempotencyKey": f"{follow_key}:{alias}",
                "message": follow_message,
            })
    return deliveries


def _secondary_profile_home(profile_name: str) -> Path:
    process_home = Path(os.getenv("HERMES_HOME", "").strip() or (Path.home() / ".hermes"))
    if process_home.name == profile_name and process_home.parent.name == "profiles":
        return process_home
    return process_home / "profiles" / profile_name


def _secondary_credentials(profile_name: str) -> dict[str, str] | None:
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", profile_name):
        return None
    profile_home = _secondary_profile_home(profile_name)
    account_files = sorted(
        path
        for path in (profile_home / "weixin" / "accounts").glob("*.json")
        if not path.name.endswith(".context-tokens.json") and not path.name.endswith(".sync.json")
    )
    if len(account_files) != 1:
        return None
    try:
        account = json.loads(account_files[0].read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    token = str(account.get("token") or "").strip()
    user_id = str(account.get("user_id") or "").strip()
    if not token or not user_id:
        return None
    return {
        "account_id": account_files[0].stem,
        "token": token,
        "chat_id": user_id,
        "base_url": str(account.get("base_url") or "https://ilinkai.weixin.qq.com").rstrip("/"),
        "cooldown_home": str(profile_home),
    }


async def _send_to_recipient(
    alias: str,
    primary_chat_id: str,
    content: str,
    idempotency_key: str,
) -> dict[str, Any]:
    if alias == "primary":
        return await send_weixin_direct(
            extra={}, token=None, chat_id=primary_chat_id, message=content, idempotency_key=idempotency_key,
        )
    if alias != "secondary":
        return {"error": "recipient_not_configured"}
    profile_name, _ = local_delivery_options()
    credentials = _secondary_credentials(profile_name)
    if credentials is None:
        return {"error": "recipient_not_configured"}
    return await send_weixin_direct(
        extra={
            "account_id": credentials["account_id"],
            "base_url": credentials["base_url"],
            "cdn_base_url": "https://novac2c.cdn.weixin.qq.com/c2c",
            "cooldown_home": credentials["cooldown_home"],
        },
        token=credentials["token"],
        chat_id=credentials["chat_id"],
        message=content,
        idempotency_key=idempotency_key,
    )


async def dispatch_once(spec: RadarSpec, primary_chat_id: str) -> DispatchOutcome:
    """Claim one item, keep its body in memory, and ACK once after all keys."""
    base_url, dispatch_token, _, shadow_mode = settings()
    try:
        claim = await asyncio.to_thread(post, f"{base_url}{spec.claim_path}", dispatch_token, {
            "leaseSeconds": 300,
            "kinds": list(spec.kinds),
        })
    except Exception:
        return DispatchOutcome(infrastructure_error=True)

    item = claim.get("item")
    if item is None:
        return DispatchOutcome(infrastructure_error=False)
    if not isinstance(item, dict):
        return DispatchOutcome(infrastructure_error=True)
    item_id = str(item.get("id") or "")
    item_lease_token = lease_token(item)
    if not item_id or not item_lease_token:
        return DispatchOutcome(infrastructure_error=True)

    async def ack_once(payload: dict[str, Any]) -> bool:
        try:
            await asyncio.to_thread(post, f"{base_url}{spec.ack_path}", dispatch_token, payload)
            return True
        except Exception:
            return False

    try:
        deliveries = await _build_deliveries(spec, item, base_url, shadow_mode)
    except DeliveryBlocked as exc:
        acknowledged = await ack_once({
            "id": item_id,
            "leaseToken": item_lease_token,
            "success": False,
            "errorCode": exc.code,
            "errorMessage": exc.safe_message,
        })
        return DispatchOutcome(infrastructure_error=not acknowledged)
    except Exception:
        acknowledged = await ack_once({
            "id": item_id,
            "leaseToken": item_lease_token,
            "success": False,
            "errorCode": "delivery_plan_invalid",
            "errorMessage": "Radar delivery plan could not be prepared.",
        })
        return DispatchOutcome(infrastructure_error=not acknowledged)

    if not deliveries:
        acknowledged = await ack_once({
            "id": item_id,
            "leaseToken": item_lease_token,
            "success": False,
            "errorCode": "delivery_plan_empty",
            "errorMessage": "Radar delivery plan has no logical recipients.",
        })
        return DispatchOutcome(infrastructure_error=not acknowledged)

    _, delivery_interval = local_delivery_options()
    receipts: list[str] = []
    failures: list[str] = []
    last_attempt_by_alias: dict[str, float] = {}
    for delivery in deliveries:
        if not isinstance(delivery, dict):
            failures.append("delivery_plan_invalid")
            continue
        alias = str(delivery.get("recipientAlias") or "")
        key = str(delivery.get("idempotencyKey") or "")
        prepared_message = str(delivery.get("message") or "").strip()
        if alias not in spec.recipient_aliases or not key or not prepared_message:
            failures.append("delivery_plan_invalid")
            continue
        try:
            known_message_id = _known_message_id(spec, key)
        except Exception:
            failures.append("delivery_ledger_unavailable")
            continue
        if known_message_id:
            receipts.append(known_message_id)
            # Be conservative across process restarts: if an earlier logical
            # key for this account is already receipted, do not immediately
            # send a later key in the same fresh invocation.
            last_attempt_by_alias.setdefault(alias, _monotonic())
            continue
        last_attempt = last_attempt_by_alias.get(alias)
        if last_attempt is not None:
            wait_seconds = delivery_interval - (_monotonic() - last_attempt)
            if wait_seconds > 0:
                await _sleep(wait_seconds)
        last_attempt_by_alias[alias] = _monotonic()
        try:
            result = await _send_to_recipient(alias, primary_chat_id, prepared_message, key)
        except Exception:
            result = {"success": False, "errorCode": "weixin_send_failed"}
        message_id = confirmed_provider_message_id(result)
        if message_id:
            try:
                remember_delivery(spec, key, message_id)
            except Exception:
                failures.append("delivery_ledger_unavailable")
                continue
            receipts.append(message_id)
            continue
        error_code, _ = classify_weixin_error(result)
        if isinstance(result, dict) and result.get("success"):
            error_code = "provider_receipt_missing"
        failures.append(error_code)

    final_message_id = receipts[-1] if receipts else ""
    if failures or len(receipts) != len(deliveries) or not final_message_id:
        first_error = failures[0] if failures else "provider_receipt_missing"
        error_message = (
            f"{len(deliveries) - len(receipts)} of {len(deliveries)} logical Weixin "
            f"deliveries remain unconfirmed; first error: {first_error}."
        )
        acknowledged = await ack_once({
            "id": item_id,
            "leaseToken": item_lease_token,
            "success": False,
            "errorCode": "logical_delivery_incomplete",
            "errorMessage": error_message,
        })
        return DispatchOutcome(infrastructure_error=not acknowledged)

    acknowledged = await ack_once({
        "id": item_id,
        "leaseToken": item_lease_token,
        "success": True,
        "providerMessageId": final_message_id,
    })
    return DispatchOutcome(infrastructure_error=not acknowledged, delivered=acknowledged)
