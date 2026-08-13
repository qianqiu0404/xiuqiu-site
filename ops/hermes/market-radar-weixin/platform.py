"""Gateway adapter reserved for explicit, body-free connection tests."""

from __future__ import annotations

import json
import os
from typing import Any, Optional

from gateway.config import Platform
from gateway.platforms.base import BasePlatformAdapter, SendResult
from gateway.platforms.weixin import send_weixin_direct

from .common import classify_weixin_error, remember_connection_test
from .transport import confirmed_provider_message_id


MAX_CONNECTION_ENVELOPE_BYTES = 128


def validate_config(_config: Any) -> bool:
    return bool(os.getenv("WEIXIN_HOME_CHANNEL", "").strip())


def is_connected(_config: Any) -> bool:
    return validate_config(_config)


def env_enablement() -> dict[str, Any] | None:
    chat_id = os.getenv("WEIXIN_HOME_CHANNEL", "").strip()
    if not chat_id:
        return None
    return {"home_channel": {"chat_id": chat_id, "name": "双雷达微信连接测试"}}


class RadarWeixinAdapter(BasePlatformAdapter):
    """No production dispatch is accepted through the gateway delivery route."""

    supports_async_delivery = False

    def __init__(self, config: Any) -> None:
        super().__init__(config, Platform("radar_weixin"))
        self.config.gateway_restart_notification = False
        self.config.typing_indicator = False

    async def connect(self, *, is_reconnect: bool = False) -> bool:
        del is_reconnect
        self._running = True
        return True

    async def disconnect(self) -> None:
        self._running = False

    async def get_chat_info(self, chat_id: str) -> dict[str, Any]:
        del chat_id
        return {"name": "双雷达微信连接测试", "type": "dm"}

    async def send(
        self,
        chat_id: str,
        content: str,
        reply_to: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> SendResult:
        del reply_to, metadata
        if len(content.encode("utf-8")) > MAX_CONNECTION_ENVELOPE_BYTES:
            return SendResult(success=False, error="radar_envelope_too_large")
        try:
            envelope = json.loads(content)
        except json.JSONDecodeError:
            return SendResult(success=False, error="radar_envelope_invalid")
        if envelope != {"version": 1, "mode": "connection_test"}:
            return SendResult(success=False, error="radar_envelope_mode_not_allowed")

        test_message = "# 【影子模式测试】双雷达通知链路\n\nHermes 已连接微信；本消息不包含雷达内容，也不会写入 outbox。"
        result = await send_weixin_direct(extra={}, token=None, chat_id=chat_id, message=test_message)
        message_id = confirmed_provider_message_id(result)
        if message_id:
            remember_connection_test(message_id)
            return SendResult(success=True, message_id=message_id)
        error_code, error_message = classify_weixin_error(result)
        if isinstance(result, dict) and result.get("success"):
            error_code, error_message = "provider_receipt_missing", "Weixin provider receipt is missing."
        return SendResult(success=False, error=f"{error_code}: {error_message}")
