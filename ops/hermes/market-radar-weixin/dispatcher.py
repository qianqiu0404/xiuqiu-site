"""Market Radar CLI entry point."""

from __future__ import annotations

import argparse
import asyncio

from .common import RadarSpec, connection_test_envelope, prepare


SPEC = RadarSpec(
    name="market-radar",
    claim_path="/api/market-radar/outbox/claim",
    ack_path="/api/market-radar/outbox/ack",
    health_path="/api/market-radar/summary",
    page_prefix="/market-radar/",
    default_title="交易雷达",
    footer="仅供研究，不构成投资建议。",
    kinds=("p0", "daily"),
    recipient_aliases=("primary", "secondary"),
)


def register_cli(parser: argparse.ArgumentParser) -> None:
    subparsers = parser.add_subparsers(dest="market_radar_action")
    command = subparsers.add_parser("prepare", help="Claim one market message for gateway delivery")
    command.add_argument("--dry-run", action="store_true")
    subparsers.add_parser("connection-test", help="Emit a gateway-only shadow test envelope")
    parser.set_defaults(func=dispatch_command)


def dispatch_command(args: argparse.Namespace) -> int:
    action = getattr(args, "market_radar_action", None)
    if action == "connection-test":
        print(connection_test_envelope())
        return 0
    if action != "prepare":
        print("Usage: hermes market-radar prepare [--dry-run] | connection-test")
        return 2
    try:
        return asyncio.run(prepare(SPEC, args.dry_run))
    except RuntimeError as exc:
        print(f"market-radar: {exc}")
        return 1
