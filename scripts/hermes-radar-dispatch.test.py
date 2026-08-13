#!/usr/bin/env python3
"""Focused executable tests for the model-free Hermes radar transport."""

from __future__ import annotations

import asyncio
import contextlib
import copy
import importlib.util
import io
import json
import sys
import tempfile
import types
import urllib.error
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional


sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
PLUGIN_DIR = ROOT / "ops" / "hermes" / "market-radar-weixin"
TEST_HOME = tempfile.TemporaryDirectory(prefix="xiuqiu-hermes-radar-test-")


def _cfg_get(config: dict[str, Any], *path: str, default: Any = None) -> Any:
    value: Any = config
    for key in path:
        if not isinstance(value, dict) or key not in value:
            return default
        value = value[key]
    return value


def _install_import_stubs() -> None:
    hermes_constants = types.ModuleType("hermes_constants")
    hermes_constants.get_hermes_home = lambda: Path(TEST_HOME.name)
    sys.modules["hermes_constants"] = hermes_constants

    hermes_cli = types.ModuleType("hermes_cli")
    hermes_cli.__path__ = []
    hermes_config = types.ModuleType("hermes_cli.config")
    hermes_config.cfg_get = _cfg_get
    hermes_config.load_config = lambda: {}
    sys.modules["hermes_cli"] = hermes_cli
    sys.modules["hermes_cli.config"] = hermes_config

    gateway = types.ModuleType("gateway")
    gateway.__path__ = []
    gateway_config = types.ModuleType("gateway.config")

    class Platform(str):
        pass

    gateway_config.Platform = Platform
    gateway_platforms = types.ModuleType("gateway.platforms")
    gateway_platforms.__path__ = []
    gateway_base = types.ModuleType("gateway.platforms.base")

    @dataclass
    class SendResult:
        success: bool
        message_id: Optional[str] = None
        error: Optional[str] = None
        raw_response: Any = None
        retryable: bool = False
        retry_after: Optional[float] = None

    class BasePlatformAdapter:
        def __init__(self, config: Any, platform: Any) -> None:
            self.config = config
            self.platform = platform
            self._running = False

    gateway_base.BasePlatformAdapter = BasePlatformAdapter
    gateway_base.SendResult = SendResult
    gateway_weixin = types.ModuleType("gateway.platforms.weixin")

    async def _unexpected_send(**_kwargs: Any) -> dict[str, Any]:
        raise AssertionError("send_weixin_direct must be replaced by the test")

    gateway_weixin.send_weixin_direct = _unexpected_send
    sys.modules["gateway"] = gateway
    sys.modules["gateway.config"] = gateway_config
    sys.modules["gateway.platforms"] = gateway_platforms
    sys.modules["gateway.platforms.base"] = gateway_base
    sys.modules["gateway.platforms.weixin"] = gateway_weixin


def _load_plugin() -> tuple[Any, Any, Any]:
    package_name = "xiuqiu_hermes_radar_test_plugin"
    package = types.ModuleType(package_name)
    package.__path__ = [str(PLUGIN_DIR)]
    sys.modules[package_name] = package

    common_spec = importlib.util.spec_from_file_location(
        f"{package_name}.common",
        PLUGIN_DIR / "common.py",
    )
    assert common_spec and common_spec.loader
    common = importlib.util.module_from_spec(common_spec)
    sys.modules[common_spec.name] = common
    common_spec.loader.exec_module(common)

    transport_spec = importlib.util.spec_from_file_location(
        f"{package_name}.transport",
        PLUGIN_DIR / "transport.py",
    )
    assert transport_spec and transport_spec.loader
    transport = importlib.util.module_from_spec(transport_spec)
    sys.modules[transport_spec.name] = transport
    transport_spec.loader.exec_module(transport)

    platform_spec = importlib.util.spec_from_file_location(
        f"{package_name}.platform",
        PLUGIN_DIR / "platform.py",
    )
    assert platform_spec and platform_spec.loader
    platform = importlib.util.module_from_spec(platform_spec)
    sys.modules[platform_spec.name] = platform
    platform_spec.loader.exec_module(platform)
    return common, transport, platform


class _Response:
    def __init__(self, value: Any, status: int = 200) -> None:
        self.status = status
        self._body = json.dumps(value).encode("utf-8")

    def __enter__(self) -> "_Response":
        return self

    def __exit__(self, *_args: Any) -> None:
        return None

    def read(self, _limit: int = -1) -> bytes:
        return self._body


def test_post_is_single_attempt(common: Any) -> None:
    original = common.urllib.request.urlopen
    calls: list[str] = []

    def fail_transport(_request: Any, timeout: int) -> Any:
        assert timeout == 15
        calls.append("transport")
        raise urllib.error.URLError("offline")

    common.urllib.request.urlopen = fail_transport
    try:
        try:
            common.post(f"{common.PRODUCTION_BASE_URL}/api/market-radar/outbox/claim", "token", {})
        except RuntimeError as exc:
            assert "transport unavailable" in str(exc)
        else:
            raise AssertionError("transport failure must be visible")
        assert calls == ["transport"], calls

        calls.clear()

        def fail_http(request: Any, timeout: int) -> Any:
            assert timeout == 15
            calls.append("http")
            raise urllib.error.HTTPError(request.full_url, 503, "unavailable", {}, None)

        common.urllib.request.urlopen = fail_http
        try:
            common.post(f"{common.PRODUCTION_BASE_URL}/api/market-radar/outbox/ack", "token", {})
        except RuntimeError as exc:
            assert "HTTP 503" in str(exc)
        else:
            raise AssertionError("HTTP failure must be visible")
        assert calls == ["http"], calls
    finally:
        common.urllib.request.urlopen = original


def test_get_health_can_retry(common: Any) -> None:
    original_urlopen = common.urllib.request.urlopen
    original_retry = common._retry_delay
    attempts = 0

    def flaky(_request: Any, timeout: int) -> _Response:
        nonlocal attempts
        assert timeout == 15
        attempts += 1
        if attempts < 3:
            raise urllib.error.URLError("temporary")
        return _Response({"status": "ok"})

    common.urllib.request.urlopen = flaky
    common._retry_delay = lambda attempt: attempt < 2
    try:
        common.check_health(common.PRODUCTION_BASE_URL, "/api/market-radar/summary")
        assert attempts == 3
    finally:
        common.urllib.request.urlopen = original_urlopen
        common._retry_delay = original_retry


def test_get_page_can_retry(common: Any) -> None:
    original_urlopen = common.urllib.request.urlopen
    original_retry = common._retry_delay
    attempts = 0

    def flaky(_request: Any, timeout: int) -> _Response:
        nonlocal attempts
        assert timeout == 15
        attempts += 1
        if attempts == 1:
            raise urllib.error.URLError("temporary")
        return _Response("published 2026-08-13")

    common.urllib.request.urlopen = flaky
    common._retry_delay = lambda attempt: attempt < 1
    try:
        page_url = common.check_page(
            {"pageUrl": "/market-radar/2026-08-13", "date": "2026-08-13"},
            common.PRODUCTION_BASE_URL,
            "/market-radar/",
        )
        assert page_url == f"{common.PRODUCTION_BASE_URL}/market-radar/2026-08-13"
        assert attempts == 2
    finally:
        common.urllib.request.urlopen = original_urlopen
        common._retry_delay = original_retry


def test_prepare_keeps_stdout_silent(common: Any, transport: Any) -> None:
    original_settings = common.settings
    original_health = common.check_health
    original_dispatch = transport.dispatch_once
    common.settings = lambda: (common.PRODUCTION_BASE_URL, "token", "primary", False)
    common.check_health = lambda *_args: None
    spec = common.RadarSpec(
        name="market-radar",
        claim_path="/api/market-radar/outbox/claim",
        ack_path="/api/market-radar/outbox/ack",
        health_path="/api/market-radar/summary",
        page_prefix="/market-radar/",
        default_title="交易雷达",
        footer="仅供研究",
        kinds=("daily",),
        recipient_aliases=("primary", "secondary"),
    )
    try:
        cases = [
            (transport.DispatchOutcome(False, True), 0),
            (transport.DispatchOutcome(False, False), 0),
            (transport.DispatchOutcome(True, False), 1),
        ]
        for outcome, expected_code in cases:
            transport.dispatch_once = lambda *_args, value=outcome: asyncio.sleep(0, result=value)
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                assert asyncio.run(common.prepare(spec, False)) == expected_code
            assert output.getvalue() == "[SILENT]\n"
    finally:
        common.settings = original_settings
        common.check_health = original_health
        transport.dispatch_once = original_dispatch


def _market_item(lease: str) -> dict[str, Any]:
    return {
        "id": "outbox-2026-08-13",
        "kind": "daily",
        "idempotencyKey": "market:daily:2026-08-13",
        "leaseToken": lease,
        "payload": {
            "date": "2026-08-13",
            "title": "交易雷达",
            "body": "30秒结论与三项重点观察。",
            "pageUrl": "/market-radar/2026-08-13",
            "followUp": {
                "kind": "quant",
                "idempotencyKey": "market:quant:2026-08-13",
                "date": "2026-08-13",
                "title": "量化简报",
                "body": "样本门禁关闭，不输出精确概率。",
                "pageUrl": "/market-radar/2026-08-13",
            },
        },
    }


def test_partial_delivery_continues_and_retry_skips_receipts(common: Any, transport: Any, platform: Any) -> None:
    run = 0
    acknowledgements: list[dict[str, Any]] = []
    send_attempts: list[str] = []
    clock = 0.0
    waits: list[float] = []
    market_spec = common.RadarSpec(
        name="market-radar",
        claim_path="/api/market-radar/outbox/claim",
        ack_path="/api/market-radar/outbox/ack",
        health_path="/api/market-radar/summary",
        page_prefix="/market-radar/",
        default_title="交易雷达",
        footer="仅供研究",
        kinds=("p0", "daily"),
        recipient_aliases=("primary", "secondary"),
    )

    def fake_post(url: str, _token: str, payload: dict[str, Any]) -> dict[str, Any]:
        nonlocal run
        if url.endswith("/claim"):
            run += 1
            return {"item": _market_item(f"lease-{run}")}
        assert url.endswith("/ack")
        acknowledgements.append(copy.deepcopy(payload))
        return {"status": "pending" if not payload["success"] else "sent"}

    async def first_send(_alias: str, _chat_id: str, _content: str, key: str) -> dict[str, Any]:
        send_attempts.append(key)
        if key == "market:daily:2026-08-13:primary":
            return {
                "success": True,
                "message_id": "hermes-weixin-local-client-id",
                "providerMessageId": "hermes-weixin-local-client-id",
            }
        provider_id = f"provider-{len(send_attempts)}"
        return {"success": True, "message_id": provider_id, "providerMessageId": provider_id}

    transport.settings = lambda: (common.PRODUCTION_BASE_URL, "token", "primary", False)
    transport.local_delivery_options = lambda: ("radar-secondary", 35)
    transport.check_page = lambda payload, base_url, _prefix: f"{base_url}{payload['pageUrl']}"
    transport.post = fake_post
    transport._send_to_recipient = first_send
    transport._monotonic = lambda: clock

    async def fake_sleep(seconds: float) -> None:
        nonlocal clock
        waits.append(seconds)
        clock += seconds

    transport._sleep = fake_sleep

    first_result = asyncio.run(transport.dispatch_once(market_spec, "primary-channel"))

    expected_keys = [
        "market:daily:2026-08-13:primary",
        "market:daily:2026-08-13:secondary",
        "market:quant:2026-08-13:primary",
        "market:quant:2026-08-13:secondary",
    ]
    assert send_attempts == expected_keys
    assert waits == [35], waits
    assert not first_result.infrastructure_error
    assert not first_result.delivered
    assert acknowledgements == [{
        "id": "outbox-2026-08-13",
        "leaseToken": "lease-1",
        "success": False,
        "errorCode": "logical_delivery_incomplete",
        "errorMessage": "1 of 4 logical Weixin deliveries remain unconfirmed; first error: provider_receipt_missing.",
    }]
    ledger = common.read_ledger(market_spec)
    assert expected_keys[0] not in ledger
    assert set(ledger) == set(expected_keys[1:])
    assert not (Path(TEST_HOME.name) / "state" / "radar-weixin-pending").exists()

    acknowledgements.clear()
    send_attempts.clear()

    async def retry_send(_alias: str, _chat_id: str, _content: str, key: str) -> dict[str, Any]:
        send_attempts.append(key)
        return {"success": True, "message_id": "provider-retry", "providerMessageId": "provider-retry"}

    transport._send_to_recipient = retry_send
    second_result = asyncio.run(transport.dispatch_once(market_spec, "primary-channel"))
    assert not second_result.infrastructure_error
    assert second_result.delivered
    assert send_attempts == [expected_keys[0]]
    assert waits == [35], waits
    assert acknowledgements == [{
        "id": "outbox-2026-08-13",
        "leaseToken": "lease-2",
        "success": True,
        "providerMessageId": "provider-4",
    }]
    ledger = common.read_ledger(market_spec)
    assert set(ledger) == set(expected_keys)
    assert all(value.get("providerMessageId") for value in ledger.values())

    config = types.SimpleNamespace(gateway_restart_notification=True, typing_indicator=True)
    adapter = platform.RadarWeixinAdapter(config)
    rejected = asyncio.run(adapter.send(
        "primary-channel",
        json.dumps({"version": 1, "mode": "dispatch", "radar": "market-radar"}),
    ))
    assert not rejected.success
    assert rejected.error == "radar_envelope_mode_not_allowed"


def main() -> None:
    _install_import_stubs()
    common, transport, platform = _load_plugin()
    test_post_is_single_attempt(common)
    test_get_health_can_retry(common)
    test_get_page_can_retry(common)
    test_prepare_keeps_stdout_silent(common, transport)
    test_partial_delivery_continues_and_retry_skips_receipts(common, transport, platform)
    print("OK")


if __name__ == "__main__":
    try:
        main()
    finally:
        TEST_HOME.cleanup()
