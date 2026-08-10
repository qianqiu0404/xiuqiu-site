"""Gateway-local transport that sends prepared radar envelopes via live Weixin."""

from __future__ import annotations

import asyncio
import json
import os
import re
from pathlib import Path
from typing import Any, Optional

from gateway.config import Platform
from gateway.platforms.base import BasePlatformAdapter, SendResult
from gateway.platforms.weixin import send_weixin_direct

from .common import (
    classify_weixin_error,
    forget_pending_delivery,
    load_pending_delivery,
    local_delivery_options,
    post,
    read_ledger,
    remember_connection_test,
    remember_delivery,
    settings,
)
from .dispatcher import SPEC as MARKET_SPEC
from .learning_dispatcher import SPEC as LEARNING_SPEC


SPECS = {MARKET_SPEC.name: MARKET_SPEC, LEARNING_SPEC.name: LEARNING_SPEC}


def _known_message_id(spec, key: str) -> str:
    ledger = read_ledger(spec)
    value = ledger.get(key) or {}
    message_id = str(value.get("providerMessageId") or "")
    if message_id:
        return message_id
    if key.endswith(":primary"):
        legacy = ledger.get(key.removesuffix(":primary")) or {}
        return str(legacy.get("providerMessageId") or "")
    return ""


def _secondary_credentials(profile_name: str) -> dict[str, str] | None:
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", profile_name):
        return None
    profile_home = Path.home() / ".hermes" / "profiles" / profile_name
    account_files = sorted((profile_home / "weixin" / "accounts").glob("*.json"))
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
    }


async def _send_to_recipient(alias: str, primary_chat_id: str, content: str) -> dict[str, Any]:
    if alias == "primary":
        return await send_weixin_direct(extra={}, token=None, chat_id=primary_chat_id, message=content)
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
        },
        token=credentials["token"],
        chat_id=credentials["chat_id"],
        message=content,
    )


def validate_config(_config: Any) -> bool:
    return bool(os.getenv("WEIXIN_HOME_CHANNEL", "").strip()) and bool(
        (os.getenv("RADAR_DISPATCH_TOKEN") or os.getenv("MARKET_RADAR_DISPATCH_TOKEN") or "").strip()
    )


def is_connected(_config: Any) -> bool:
    return validate_config(_config)


def env_enablement() -> dict[str, Any] | None:
    chat_id = os.getenv("WEIXIN_HOME_CHANNEL", "").strip()
    if not chat_id or not validate_config(None):
        return None
    return {
        "home_channel": {"chat_id": chat_id, "name": "双雷达微信"},
    }


class RadarWeixinAdapter(BasePlatformAdapter):
    """Outbound-only adapter; the live gateway owns the Weixin connection."""

    supports_async_delivery = False

    def __init__(self, config: Any) -> None:
        super().__init__(config, Platform("radar_weixin"))
        self.config.gateway_restart_notification = False
        self.config.typing_indicator = False

    async def connect(self, *, is_reconnect: bool = False) -> bool:
        self._running = True
        return True

    async def disconnect(self) -> None:
        self._running = False

    async def get_chat_info(self, chat_id: str) -> dict[str, Any]:
        del chat_id
        return {"name": "双雷达微信", "type": "dm"}

    async def send(
        self,
        chat_id: str,
        content: str,
        reply_to: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> SendResult:
        del reply_to, metadata
        try:
            envelope = json.loads(content)
        except json.JSONDecodeError:
            return SendResult(success=False, error="radar_envelope_invalid")
        if not isinstance(envelope, dict) or envelope.get("version") != 1:
            return SendResult(success=False, error="radar_envelope_invalid")

        mode = envelope.get("mode")
        if mode == "connection_test":
            return await self._send_connection_test(chat_id, envelope)
        if mode != "deliver":
            return SendResult(success=False, error="radar_envelope_mode_not_allowed")
        return await self._deliver(chat_id, envelope)

    async def _send_connection_test(self, chat_id: str, envelope: dict[str, Any]) -> SendResult:
        if set(envelope) != {"version", "mode"}:
            return SendResult(success=False, error="radar_connection_test_invalid")
        message = "# 【影子模式测试】双雷达通知链路\n\nHermes 已连接微信；本消息不包含雷达内容，也不会写入 outbox。"
        result = await send_weixin_direct(extra={}, token=None, chat_id=chat_id, message=message)
        if result.get("success") and not result.get("error") and result.get("message_id"):
            message_id = str(result["message_id"])
            remember_connection_test(message_id)
            return SendResult(success=True, message_id=message_id)
        error_code, error_message = classify_weixin_error(result.get("error"))
        return SendResult(success=False, error=f"{error_code}: {error_message}")

    async def _deliver(self, chat_id: str, envelope: dict[str, Any]) -> SendResult:
        reference = str(envelope.get("deliveryRef") or "")
        if set(envelope) != {"version", "mode", "deliveryRef"}:
            return SendResult(success=False, error="radar_envelope_invalid")
        pending = load_pending_delivery(reference)
        if pending is None:
            return SendResult(success=False, error="radar_delivery_reference_missing")
        radar = str(pending.get("radar") or "")
        spec = SPECS.get(radar)
        item_id = str(pending.get("itemId") or "")
        lease_token = str(pending.get("leaseToken") or "")
        deliveries = pending.get("deliveries")
        if spec is None or not item_id or not lease_token or not isinstance(deliveries, list) or not deliveries:
            return SendResult(success=False, error="radar_envelope_invalid")

        base_url, dispatch_token, _, _ = settings()
        if not dispatch_token:
            return SendResult(success=False, error="radar_dispatch_token_missing")

        _, delivery_interval = local_delivery_options()
        receipts = []
        sent_now = 0
        for delivery in deliveries:
            if not isinstance(delivery, dict):
                return SendResult(success=False, error="radar_envelope_invalid")
            alias = str(delivery.get("recipientAlias") or "")
            key = str(delivery.get("idempotencyKey") or "")
            prepared_message = str(delivery.get("message") or "").strip()
            if alias not in spec.recipient_aliases or not key or not prepared_message:
                return SendResult(success=False, error="radar_envelope_invalid")
            known_message_id = _known_message_id(spec, key)
            if known_message_id:
                receipts.append(known_message_id)
                continue
            if sent_now:
                await asyncio.sleep(delivery_interval)
            result = await _send_to_recipient(alias, chat_id, prepared_message)
            if result.get("success") and not result.get("error") and result.get("message_id"):
                message_id = str(result["message_id"])
                remember_delivery(spec, key, message_id)
                receipts.append(message_id)
                sent_now += 1
                continue

            error_code, error_message = classify_weixin_error(result.get("error"))
            try:
                await asyncio.to_thread(post, f"{base_url}{spec.ack_path}", dispatch_token, {
                    "id": item_id, "leaseToken": lease_token, "success": False,
                    "errorCode": error_code, "errorMessage": error_message,
                })
            except Exception as exc:
                return SendResult(success=False, error=f"radar_ack_failed:{type(exc).__name__}")
            forget_pending_delivery(reference)
            return SendResult(success=False, error=f"{error_code}: {error_message}")

        final_message_id = receipts[-1] if receipts else ""
        if not final_message_id:
            return SendResult(success=False, error="radar_delivery_receipt_missing")
        try:
            await asyncio.to_thread(post, f"{base_url}{spec.ack_path}", dispatch_token, {
                "id": item_id, "leaseToken": lease_token, "success": True,
                "providerMessageId": final_message_id,
            })
        except Exception as exc:
            return SendResult(success=False, error=f"radar_ack_failed:{type(exc).__name__}")
        forget_pending_delivery(reference)
        return SendResult(success=True, message_id=final_message_id)
