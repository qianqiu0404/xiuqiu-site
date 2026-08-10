import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { parse } from 'yaml'
import { buildLearningDailyNotification, buildMarketDailyNotification, buildMarketQuantNotification } from './radar-notification-contracts.mjs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('learning notification highlights at most three items and has one daily key', () => {
  const notification = buildLearningDailyNotification({
    date: '2026-08-10',
    marketSignals: [
      { title: '钱包信号一', summary: '一号摘要' },
      { title: '钱包信号二', summary: '二号摘要' },
    ],
    aiTip: { title: 'AI Engineering', summary: 'AI 摘要' },
    web3Design: { title: 'Web3 Design', summary: 'Web3 摘要' },
    vibeProject: { title: '工具项目', summary: '工具摘要' },
    readingPick: { title: '长文阅读', summary: '长文摘要' },
  })
  assert.equal(notification.idempotencyKey, 'learning:daily:2026-08-10')
  assert.equal(notification.payload.pageUrl, '/radar/2026-08-10')
  assert.equal(notification.payload.itemCount, 6)
  assert.equal((notification.payload.body.match(/^\d+\./gm) || []).length, 3)
  assert.doesNotMatch(notification.payload.body, /钱包信号二/)
})

test('market daily is bounded and quiet days remain observable', () => {
  const event = priority => ({ priority, title: `${priority} 事件`, whyWatch: `${priority} 观察边界` })
  const notification = buildMarketDailyNotification({ date: '2026-08-10', events: [event('P2'), event('P0'), event('P1'), event('P2')] })
  assert.equal(notification.idempotencyKey, 'market:daily:2026-08-10')
  assert.equal(notification.payload.pageUrl, '/market-radar/2026-08-10')
  assert.equal((notification.payload.body.match(/^\d+\./gm) || []).length, 3)
  assert.ok(notification.payload.body.indexOf('P0') < notification.payload.body.indexOf('P1'))
  const quiet = buildMarketDailyNotification({ date: '2026-08-10', events: [] })
  assert.match(quiet.payload.body, /暂无达到公开门槛的重要事件/)
})

test('market quant follow-up uses bounded three-way weights and a separate idempotency key', () => {
  const quantStrategy = {
    horizonTradingDays: 3,
    status: 'heuristic_unbacktested',
    methodology: '透明启发式，尚未历史回测。',
    assets: [
      ['SPY', 'us_equity_etf', 34, 41, 25], ['QQQ', 'us_equity_etf', 36, 36, 28],
      ['BTC', 'crypto', 27, 40, 33], ['ETH', 'crypto', 25, 40, 35], ['GLD', 'gold_etf', 42, 36, 22],
    ].map(([symbol, group, up, sideways, down]) => ({ symbol, group, up, sideways, down })),
    rationale: '当前动量与公开事件共同提高不确定性。',
    nextValidation: '核对事件结果与资产反应。',
    invalidation: '窗口结束或来源更新后重新计算。',
    sourceUrls: ['https://www.federalreserve.gov/example'],
  }
  const quant = buildMarketQuantNotification({ date: '2026-08-10', quantStrategy })
  assert.equal(quant.idempotencyKey, 'market:quant:2026-08-10')
  assert.equal(quant.payload.probabilityStatus, 'heuristic_unbacktested')
  assert.match(quant.payload.body, /SPY：上涨 34%｜震荡 41%｜下跌 25%/)
  assert.match(quant.payload.body, /尚未历史回测/)
  const daily = buildMarketDailyNotification({ date: '2026-08-10', events: [], quantStrategy })
  assert.equal(daily.payload.followUp.idempotencyKey, 'market:quant:2026-08-10')
  assert.equal(daily.payload.followUp.kind, 'quant')
})

test('two outboxes have isolated schemas, idempotency keys and delivery evidence', () => {
  const migration = read('market-radar/migrations/004_dual_radar_notifications.sql')
  const marketClaim = read('api/market-radar/outbox/claim.ts')
  const learningClaim = read('api/radar/outbox/claim.ts')
  const marketAck = read('api/market-radar/outbox/ack.ts')
  const learningAck = read('api/radar/outbox/ack.ts')
  assert.match(migration, /create schema if not exists learning_radar/)
  assert.match(migration, /create table if not exists learning_radar\.outbox/)
  assert.match(migration, /learning_radar\.delivery_logs/)
  assert.match(marketClaim, /kind = any\(\$3::text\[\]\)/)
  assert.match(learningClaim, /LEARNING_NOTIFICATION_KINDS/)
  assert.match(`${marketAck}\n${learningAck}`, /providerMessageId/)
  assert.match(`${marketAck}\n${learningAck}`, /error_message/)
  assert.match(`${marketAck}\n${learningAck}`, /attempts \+ 1 >= 5/)
})

test('release controller enqueues daily notifications only after production promotion', () => {
  const workflow = parse(read('.github/workflows/release-controller.yml'))
  assert.deepEqual(workflow.jobs.enqueue_radar_notifications.needs, ['preflight', 'mark_deployed_sha'])
  assert.equal(workflow.jobs.enqueue_radar_notifications.environment, 'production-release')
  assert.deepEqual(workflow.jobs.promote_market_radar_worker.needs, ['preflight', 'mark_deployed_sha', 'enqueue_radar_notifications'])
  const enqueueStep = workflow.jobs.enqueue_radar_notifications.steps.find(step => step.name === 'Enqueue idempotent daily radar notifications')
  assert.match(enqueueStep.run, /npm run notifications:enqueue/)
})

test('Hermes dispatchers are model-free, one-at-a-time and keep the radar lanes isolated', () => {
  const common = read('ops/hermes/market-radar-weixin/common.py')
  const market = read('ops/hermes/market-radar-weixin/dispatcher.py')
  const learning = read('ops/hermes/market-radar-weixin/learning_dispatcher.py')
  const platform = read('ops/hermes/market-radar-weixin/platform.py')
  const registration = read('ops/hermes/market-radar-weixin/__init__.py')
  const marketScript = read('ops/hermes/scripts/market-radar-dispatch.sh')
  const learningScript = read('ops/hermes/scripts/learning-radar-dispatch.sh')
  assert.match(common, /store_pending_delivery/)
  assert.match(common, /market:quant/)
  assert.match(common, /\[SILENT\]/)
  assert.match(common, /remember_delivery/)
  assert.match(common, /page_date_missing/)
  assert.match(common, /weixin_rate_limited/)
  assert.doesNotMatch(common, /send_weixin_direct/)
  assert.match(platform, /send_weixin_direct/)
  assert.match(platform, /providerMessageId/)
  assert.match(common, /secondary_profile/)
  assert.match(platform, /recipientAlias/)
  assert.match(platform, /forget_pending_delivery/)
  assert.match(registration, /name="radar_weixin"/)
  assert.match(registration, /cron_deliver_env_var="WEIXIN_HOME_CHANNEL"/)
  assert.match(market, /kinds=\("p0", "daily"\)/)
  assert.match(market, /recipient_aliases=\("primary", "secondary"\)/)
  assert.match(market, /page_prefix="\/market-radar\/"/)
  assert.match(learning, /kinds=\("daily",\)/)
  assert.match(learning, /page_prefix="\/radar\/"/)
  assert.doesNotMatch(`${marketScript}\n${learningScript}`, /--model|--provider|api[_-]?key/i)
  assert.match(marketScript, /market-radar prepare/)
  assert.match(learningScript, /learning-radar prepare/)
  assert.doesNotMatch(`${common}\n${marketScript}\n${learningScript}`, /leaseToken.*print|dispatch_token.*print/i)
})

test('gateway watchdog cross-notifies once after two failures and once on recovery', () => {
  const root = mkdtempSync(join(tmpdir(), 'xiuqiu-gateway-watchdog-'))
  const primaryHome = join(root, '.hermes')
  const secondaryHome = join(primaryHome, 'profiles', 'radar-secondary')
  const stateDir = join(primaryHome, 'state')
  const fakeHermes = join(root, 'fake-hermes.sh')
  const sentMessages = join(root, 'messages.log')
  mkdirSync(join(secondaryHome, 'state'), { recursive: true })
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(fakeHermes, '#!/bin/bash\nprintf \'%s\\n\' "$*" >> "$WATCHDOG_TEST_MESSAGES"\nprintf \'{"success":true,"message_id":"watchdog-test-receipt"}\\n\'\n')
  chmodSync(fakeHermes, 0o700)
  const script = new URL('../ops/hermes/scripts/gateway-peer-watchdog.sh', import.meta.url)
  const env = {
    ...process.env,
    HOME: root,
    HERMES_HOME: primaryHome,
    HERMES_BIN: fakeHermes,
    WATCHDOG_TEST_MESSAGES: sentMessages,
    GATEWAY_WATCHDOG_PRIMARY_HOME: primaryHome,
    GATEWAY_WATCHDOG_SECONDARY_HOME: secondaryHome,
    GATEWAY_WATCHDOG_STATE_DIR: stateDir,
    GATEWAY_WATCHDOG_NO_JITTER: '1',
  }
  execFileSync('bash', [script.pathname], { env })
  assert.throws(() => readFileSync(sentMessages, 'utf8'), /ENOENT/)
  execFileSync('bash', [script.pathname], { env })
  assert.match(readFileSync(sentMessages, 'utf8'), /第二微信 gateway 连续 2 次健康检查失败/)

  writeFileSync(join(secondaryHome, 'gateway_state.json'), JSON.stringify({
    pid: process.pid,
    gateway_state: 'running',
    platforms: { weixin: { state: 'connected' } },
  }))
  const heartbeat = join(secondaryHome, 'state', 'gateway.heartbeat')
  writeFileSync(heartbeat, JSON.stringify({ pid: process.pid }))
  const now = new Date()
  utimesSync(heartbeat, now, now)
  execFileSync('bash', [script.pathname], { env })
  const messages = readFileSync(sentMessages, 'utf8')
  assert.equal((messages.match(/Hermes 双微信告警/g) || []).length, 1)
  assert.equal((messages.match(/Hermes 双微信恢复/g) || []).length, 1)
  const receipt = JSON.parse(readFileSync(join(stateDir, 'gateway-peer-watchdog-secondary.json'), 'utf8'))
  assert.equal(receipt.health, 'healthy')
  assert.equal(receipt.alerted, false)
  assert.equal(receipt.providerMessageId, 'watchdog-test-receipt')
  assert.equal(receipt.lastNotificationKind, 'recovery')
  execFileSync('bash', [script.pathname], { env })
  const preservedReceipt = JSON.parse(readFileSync(join(stateDir, 'gateway-peer-watchdog-secondary.json'), 'utf8'))
  assert.equal(preservedReceipt.providerMessageId, 'watchdog-test-receipt')
  assert.equal(preservedReceipt.lastNotificationKind, 'recovery')
})
