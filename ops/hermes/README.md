# Hermes 双雷达派发

`market-radar-weixin` 插件注册两个独立的领取命令和一个仅出站的网关适配器：

- `hermes market-radar prepare` 只领取 `p0`、`daily`。
- `hermes learning-radar prepare` 只领取 `daily`。
- `radar_weixin` 在正在运行的 Hermes 网关内复用已配对的微信连接，真实发送后再 ACK。

两个命令共用 Hermes 已配对的微信 Home Channel，但使用独立 API、outbox、幂等键和本地送达账本。每次最多领取一条；发送前必须验证生产页面和日期标记。脚本仅向 cron 输出一个不含 token、频道标识或 lease token 的短期本机引用，敏感领取状态保存在权限为 `0600` 的本地文件。成功送达先写本地账本，再 ACK 数据库，降低“微信已发、ACK 中断”造成的重复风险。

本机只需要 `RADAR_DISPATCH_TOKEN`（兼容已有 `MARKET_RADAR_DISPATCH_TOKEN`）与 `WEIXIN_HOME_CHANNEL`。仓库不保存任何值。cron 必须使用 `--no-agent --deliver radar_weixin`，并设置 `cron.wrap_response: false`；两个任务按五分钟周期错开两分钟。
