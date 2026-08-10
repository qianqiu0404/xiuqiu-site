"""Learning Radar CLI entry point."""

from __future__ import annotations

import argparse
import asyncio

from .common import RadarSpec, prepare


SPEC = RadarSpec(
    name="learning-radar",
    claim_path="/api/radar/outbox/claim",
    ack_path="/api/radar/outbox/ack",
    health_path="/radar",
    page_prefix="/radar/",
    default_title="学习雷达",
    footer="公开来源驱动，仅供学习与研究。",
    kinds=("daily",),
    recipient_aliases=("primary",),
)


def register_cli(parser: argparse.ArgumentParser) -> None:
    subparsers = parser.add_subparsers(dest="learning_radar_action")
    command = subparsers.add_parser("prepare", help="Claim one learning message for gateway delivery")
    command.add_argument("--dry-run", action="store_true")
    parser.set_defaults(func=dispatch_command)


def dispatch_command(args: argparse.Namespace) -> int:
    if getattr(args, "learning_radar_action", None) != "prepare":
        print("Usage: hermes learning-radar prepare [--dry-run]")
        return 2
    try:
        return asyncio.run(prepare(SPEC, args.dry_run))
    except RuntimeError as exc:
        print(f"learning-radar: {exc}")
        return 1
