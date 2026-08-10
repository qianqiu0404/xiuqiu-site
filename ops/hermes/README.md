# Hermes 双雷达派发

`market-radar-weixin` 插件注册两个独立的领取命令和一个仅出站的网关适配器：

- `hermes market-radar prepare` 只领取 `p0`、`daily`；`daily` 可携带通过内容门禁的量化跟进消息。
- `hermes learning-radar prepare` 只领取 `daily`。
- `radar_weixin` 在正在运行的 Hermes 网关内复用已配对的微信连接，真实发送后再 ACK。

两个命令使用独立 API、outbox、幂等键和本地送达账本。交易雷达在本机展开为 `primary`、`secondary` 两个收件人，账号凭据只从各自 Hermes profile 读取；日报与量化跟进分别使用 `market:daily:<date>:<alias>`、`market:quant:<date>:<alias>`。每次最多领取一条；发送前必须验证生产页面和日期标记。脚本仅向 cron 输出一个不含 token、频道标识或 lease token 的短期本机引用，敏感领取状态保存在权限为 `0600` 的本地文件。每条真实发送先写本地账本；只有全部目标完成后才 ACK 数据库，失败重跑只补缺失目标。

本机只需要 `RADAR_DISPATCH_TOKEN`（兼容已有 `MARKET_RADAR_DISPATCH_TOKEN`）与主账号 `WEIXIN_HOME_CHANNEL`。插件配置中的 `secondary_profile` 只保存 profile 别名，不保存账号 ID、频道或 token；`delivery_interval_seconds` 不得低于 35 秒。仓库不保存任何凭据值。cron 必须使用 `--no-agent --deliver radar_weixin`，并设置 `cron.wrap_response: false`；两个任务按五分钟周期错开两分钟。
