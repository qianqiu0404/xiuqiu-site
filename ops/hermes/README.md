# Hermes 双雷达派发

`market-radar-weixin` 插件注册两个独立的领取命令和一个仅用于连接测试的网关适配器：

- `hermes market-radar prepare` 在同一个 no-agent CLI 进程内只领取 `p0`、`daily`，完成页面验证、微信发送和 ACK；`daily` 可携带通过内容门禁的量化跟进消息。
- `hermes learning-radar prepare` 在自己的 no-agent CLI 进程内只领取 `daily`，执行同样的内存闭环。
- `radar_weixin` 只接受显式 `connection-test`，拒绝任何生产 dispatch 包，避免真实派发进入网关平台路由的 60 秒确认预算。

两个命令使用独立 API、outbox、幂等键和本地送达账本。交易雷达在 CLI 进程内展开为 `primary`、`secondary` 两个收件人，账号凭据只从各自 Hermes profile 读取；日报与量化跟进分别使用 `market:daily:<date>:<alias>`、`market:quant:<date>:<alias>`。每次最多领取一条；发送前必须验证生产页面和日期标记。正文和租约只存在于本次 CLI 进程内存，stdout 无论无消息、业务失败或成功都只有 `[SILENT]`，不生成 pending 正文文件。每个账号自己的两次发送至少间隔 35 秒；取得真实 provider message id 后才写本地账本。只有全部逻辑目标完成后才 ACK 成功，否则统一 ACK 失败，重跑只补账本中缺失的目标。

本机只需要 `RADAR_DISPATCH_TOKEN`（兼容已有 `MARKET_RADAR_DISPATCH_TOKEN`）与主账号 `WEIXIN_HOME_CHANNEL`。插件配置中的 `secondary_profile` 只保存 profile 别名，不保存账号 ID、频道或 token；`delivery_interval_seconds` 不得低于 35 秒。仓库不保存任何凭据值。cron 必须使用 `--no-agent --deliver local`，并设置 `cron.wrap_response: false`；两个任务按五分钟周期错开两分钟。生产派发不得使用 `--deliver radar_weixin`。

`gateway-peer-watchdog.sh` 由两个 Hermes profile 各自以 `--no-agent` 每分钟运行。主 profile 只检查第二微信 gateway，第二 profile 只检查主微信 gateway；检查项是进程、180 秒内心跳与 Weixin adapter 连接状态。连续两次失败才由仍在线的微信发送一次告警，恢复后再发送一次恢复通知。状态与真实 `message_id` 只写入本机 `~/.hermes/state/gateway-peer-watchdog-<peer>.json`，相同故障不会重复轰炸；脚本不读取、复制或比较任何聊天内容。
