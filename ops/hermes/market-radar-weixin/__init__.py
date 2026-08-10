"""Hermes CLI registration for the two isolated xiuqiu radar dispatchers."""

from __future__ import annotations

from .dispatcher import dispatch_command as market_dispatch, register_cli as register_market
from .learning_dispatcher import dispatch_command as learning_dispatch, register_cli as register_learning


def register(ctx) -> None:
    from .platform import RadarWeixinAdapter, env_enablement, is_connected, validate_config

    ctx.register_platform(
        name="radar_weixin",
        label="双雷达微信派发",
        adapter_factory=lambda config: RadarWeixinAdapter(config),
        check_fn=lambda: True,
        validate_config=validate_config,
        is_connected=is_connected,
        env_enablement_fn=env_enablement,
        cron_deliver_env_var="WEIXIN_HOME_CHANNEL",
        max_message_length=0,
        pii_safe=True,
        allow_update_command=False,
    )
    ctx.register_cli_command(
        name="market-radar",
        help="Deliver xiuqiu Market Radar outbox messages through Weixin",
        setup_fn=register_market,
        handler_fn=market_dispatch,
        description="Prepares only market daily/P0 envelopes for gateway-confirmed Weixin delivery.",
    )
    ctx.register_cli_command(
        name="learning-radar",
        help="Deliver xiuqiu Learning Radar outbox messages through Weixin",
        setup_fn=register_learning,
        handler_fn=learning_dispatch,
        description="Prepares only learning daily envelopes for gateway-confirmed Weixin delivery.",
    )
