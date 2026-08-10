import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parse } from 'yaml'
import { buildLearningDailyNotification, buildMarketDailyNotification } from './radar-notification-contracts.mjs'

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
  assert.match(common, /\[SILENT\]/)
  assert.match(common, /remember_delivery/)
  assert.match(common, /page_date_missing/)
  assert.match(common, /weixin_rate_limited/)
  assert.doesNotMatch(common, /send_weixin_direct/)
  assert.match(platform, /send_weixin_direct/)
  assert.match(platform, /providerMessageId/)
  assert.match(platform, /forget_pending_delivery/)
  assert.match(registration, /name="radar_weixin"/)
  assert.match(registration, /cron_deliver_env_var="WEIXIN_HOME_CHANNEL"/)
  assert.match(market, /kinds=\("p0", "daily"\)/)
  assert.match(market, /page_prefix="\/market-radar\/"/)
  assert.match(learning, /kinds=\("daily",\)/)
  assert.match(learning, /page_prefix="\/radar\/"/)
  assert.doesNotMatch(`${marketScript}\n${learningScript}`, /--model|--provider|api[_-]?key/i)
  assert.match(marketScript, /market-radar prepare/)
  assert.match(learningScript, /learning-radar prepare/)
  assert.doesNotMatch(`${common}\n${marketScript}\n${learningScript}`, /leaseToken.*print|dispatch_token.*print/i)
})
