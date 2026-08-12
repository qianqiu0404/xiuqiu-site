import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { parse } from 'yaml'
import { buildLearningDailyNotification, buildMarketDailyNotification, buildMarketQuantNotification, renderMarketNotificationMessage } from './radar-notification-contracts.mjs'
import { buildMarketResearchPack } from './market-radar-contracts.mjs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const published = kind => ({
  snapshotId: `${kind}-2026-08-10-0000000000000000`,
  asOf: '2026-08-10T00:00:00.000Z',
  origin: 'research',
  publicationState: 'published',
})

test('learning notification highlights at most three items and has one daily key', () => {
  const notification = buildLearningDailyNotification({
    ...published('learning'),
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
  const notification = buildMarketDailyNotification({ ...published('market'), date: '2026-08-10', events: [event('P2'), event('P0'), event('P1'), event('P2')] })
  assert.equal(notification.idempotencyKey, 'market:daily:2026-08-10')
  assert.equal(notification.payload.pageUrl, '/market-radar/2026-08-10')
  assert.equal((notification.payload.body.match(/^\d+\./gm) || []).length, 3)
  assert.ok(notification.payload.body.indexOf('P0') < notification.payload.body.indexOf('P1'))
  const quiet = buildMarketDailyNotification({ ...published('market'), date: '2026-08-10', events: [] })
  assert.match(quiet.payload.body, /暂无达到公开门槛的重要事件/)
})

test('schema v2 market daily adds the three immutable research handoff questions within one message', () => {
  const event = {
    id: 'official-event', priority: 'P0', title: '官方事件', fact: '官方确认了待验证事件。',
    whyWatch: '它可能改变公开市场的观察边界。', watchFor: '核对正式结果与跨资产反应。',
    invalidation: '官方更新或观察窗口结束后重新评估。', sourceUrl: 'https://www.federalreserve.gov/example',
  }
  const notification = buildMarketDailyNotification({
    ...published('market'), schemaVersion: 2, date: '2026-08-10', summary: '先核对官方事件，再区分事实、推断和仍未知。',
    events: [event],
    researchQuestions: [
      { id: '1', lens: 'transmission', shortQuestion: '事件通过什么传导链影响相关资产？', focusEventIds: [event.id] },
      { id: '2', lens: 'falsification', shortQuestion: '哪些跨资产证据会推翻当前解释？', focusEventIds: [event.id] },
      { id: '3', lens: 'scenario', shortQuestion: '最强反方情景与失效条件是什么？', focusEventIds: [event.id] },
    ],
  })
  assert.equal(notification.idempotencyKey, 'market:daily:2026-08-10')
  assert.match(notification.payload.body, /【30秒结论】/)
  assert.match(notification.payload.body, /【继续问强模型】/)
  assert.match(notification.payload.body, /1\. 事件通过什么传导链/)
  assert.match(notification.payload.body, /2\. 哪些跨资产证据/)
  assert.match(notification.payload.body, /3\. 最强反方情景/)
  assert.match(notification.payload.body, /深挖1\/2\/3/)
  const expectedPack = buildMarketResearchPack({
    ...published('market'), schemaVersion: 2, date: '2026-08-10', events: [event],
    researchQuestions: [
      { id: '1', lens: 'transmission', shortQuestion: '事件通过什么传导链影响相关资产？', focusEventIds: [event.id] },
      { id: '2', lens: 'falsification', shortQuestion: '哪些跨资产证据会推翻当前解释？', focusEventIds: [event.id] },
      { id: '3', lens: 'scenario', shortQuestion: '最强反方情景与失效条件是什么？', focusEventIds: [event.id] },
    ],
  }, published('market'))
  assert.deepEqual(notification.payload.researchPackManifest, {
    schemaVersion: 2,
    date: expectedPack.date,
    snapshotId: expectedPack.snapshotId,
    asOf: expectedPack.asOf,
    pageUrl: expectedPack.pageUrl,
    questions: expectedPack.questions.map(({ id, promptChecksum }) => ({ id, promptChecksum })),
  })
  assert.ok(notification.payload.body.length <= 1800)
  assert.ok(renderMarketNotificationMessage(notification.payload).length <= 1800)
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
    sourceUrls: [
      'https://www.federalreserve.gov/example',
      'https://home.treasury.gov/example',
      'https://www.bls.gov/example',
    ],
  }
  const quant = buildMarketQuantNotification({ ...published('market'), date: '2026-08-10', quantStrategy })
  assert.equal(quant.idempotencyKey, 'market:quant:2026-08-10')
  assert.equal(quant.payload.probabilityStatus, 'heuristic_unbacktested')
  assert.match(quant.payload.body, /SPY：上涨 34%｜震荡 41%｜下跌 25%/)
  assert.match(quant.payload.body, /尚未历史回测/)
  assert.ok(quant.payload.body.length <= 1600)
  assert.equal(quant.payload.sourceUrls.length, 2)
  assert.ok(renderMarketNotificationMessage(quant.payload).length <= 1600)
  const daily = buildMarketDailyNotification({ ...published('market'), date: '2026-08-10', events: [], quantStrategy })
  assert.equal(daily.payload.followUp.idempotencyKey, 'market:quant:2026-08-10')
  assert.equal(daily.payload.followUp.kind, 'quant')
})

test('market notification limits apply to the final Hermes-rendered message, not only its body', () => {
  const strategy = {
    horizonTradingDays: 3, status: 'historical_samples_insufficient', methodology: '固定规则样本不足。', sampleSize: 0,
    assets: [
      ['SPY', 'us_equity_etf'], ['QQQ', 'us_equity_etf'], ['BTC', 'crypto'], ['ETH', 'crypto'], ['GLD', 'gold_etf'],
    ].map(([symbol, group]) => ({ symbol, group, signalQuality: 'weak' })),
    rationale: '证据'.repeat(500), nextValidation: '等待公开结果。', invalidation: '窗口结束后重算。',
    sourceUrls: [`https://example.com/${'a'.repeat(180)}`, `https://example.org/${'b'.repeat(180)}`],
  }
  assert.throws(
    () => buildMarketQuantNotification({ ...published('market'), date: '2026-08-10', quantStrategy: strategy }),
    /final rendered notification boundary/,
  )
})

test('sample-gated quant follow-up reports strength without exact probabilities', () => {
  const quantStrategy = {
    horizonTradingDays: 3,
    status: 'historical_samples_insufficient',
    methodology: '固定规则的历史样本不足。',
    sampleSize: 0,
    assets: [
      ['SPY', 'us_equity_etf'], ['QQQ', 'us_equity_etf'], ['BTC', 'crypto'],
      ['ETH', 'crypto'], ['GLD', 'gold_etf'],
    ].map(([symbol, group]) => ({ symbol, group, signalQuality: 'weak' })),
    rationale: '市场确认不足。',
    nextValidation: '等待公开结果。',
    invalidation: '窗口结束后重算。',
    sourceUrls: ['https://www.treasurydirect.gov/example'],
  }
  const quant = buildMarketQuantNotification({
    ...published('market'),
    snapshotId: 'market-2026-08-11-0000000000000000',
    date: '2026-08-11',
    quantStrategy,
  })
  assert.equal(quant.payload.probabilityStatus, 'historical_samples_insufficient')
  assert.match(quant.payload.title, /量化简报/)
  assert.match(quant.payload.body, /SPY：信号质量 弱｜历史样本不足｜不显示精确概率/)
  assert.doesNotMatch(quant.payload.body, /上涨 \d+%/)
})

test('two outboxes have isolated schemas, idempotency keys and delivery evidence', () => {
  const migration = read('market-radar/migrations/004_dual_radar_notifications.sql')
  const localRepository = read('ops/local-backend/repository.mjs')
  const externalEndpoints = [read('api/market-radar/outbox/claim.ts'), read('api/radar/outbox/claim.ts'), read('api/market-radar/outbox/ack.ts'), read('api/radar/outbox/ack.ts')].join('\n')
  assert.match(migration, /create schema if not exists learning_radar/)
  assert.match(migration, /create table if not exists learning_radar\.outbox/)
  assert.match(migration, /learning_radar\.delivery_logs/)
  assert.match(localRepository, /kind=any\(\$3::text\[\]\)/)
  assert.match(localRepository, /publication_state='published'/)
  assert.match(localRepository, /snapshot_id is not null/)
  assert.match(localRepository, /payload::text !~\*/)
  assert.match(localRepository, /provider_message_id/)
  assert.match(localRepository, /error_message/)
  assert.match(localRepository, /attempts\+1>=5/)
  assert.doesNotMatch(externalEndpoints, /getMarketRadarDb|MARKET_RADAR_DATABASE_URL/)
  assert.match(externalEndpoints, /loopback-only/)
})

test('notifications fail closed without the published research snapshot boundary', () => {
  assert.throws(() => buildLearningDailyNotification({ date: '2026-08-10' }), /snapshotId/)
  assert.throws(() => buildMarketDailyNotification({ ...published('market'), origin: 'preview', date: '2026-08-10', events: [] }), /published research/)
})

test('release controller enqueues daily notifications only after production promotion', () => {
  const workflow = parse(read('.github/workflows/release-controller.yml'))
  assert.deepEqual(workflow.jobs.enqueue_radar_notifications.needs, ['preflight', 'mark_deployed_sha'])
  assert.equal(workflow.jobs.enqueue_radar_notifications.environment, 'production-release')
  assert.deepEqual(workflow.jobs.promote_market_radar_worker.needs, ['preflight', 'mark_deployed_sha', 'enqueue_radar_notifications'])
  const enqueueStep = workflow.jobs.enqueue_radar_notifications.steps.find(step => step.name === 'Enqueue idempotent daily radar notifications')
  assert.match(enqueueStep.run, /npm run notifications:enqueue/)
})

test('Market worker reserves 00:00 UTC for the Shanghai 08:00 daily digest', () => {
  const workflow = parse(read('.github/workflows/market-radar.yml'))
  assert.deepEqual(workflow.on.schedule.map(entry => entry.cron), [
    '0 0 * * *',
    '20,40 0 * * *',
    '0,20,40 1-23 * * *',
    '45 12,13 * * 1-5',
  ])
  const gate = workflow.jobs.authorize.steps.find(step => step.name === 'Require deployed SHA marker and controller authorization')
  assert.match(gate.run, /RUN_SCHEDULE" = '0 0 \* \* \*'[^\n]*mode='daily'/)
  const run = workflow.jobs.run.steps.find(step => step.name === 'Run market radar')
  assert.match(run.run, /REQUESTED_MODE" = "daily"[^\n]*--digest=daily/)
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
  assert.match(common, /remember_pending_failure/)
  assert.match(common, /page_date_missing/)
  assert.match(common, /weixin_rate_limited/)
  assert.doesNotMatch(common, /send_weixin_direct/)
  assert.match(platform, /send_weixin_direct/)
  assert.match(platform, /providerMessageId/)
  assert.match(common, /secondary_profile/)
  assert.match(platform, /recipientAlias/)
  assert.match(platform, /forget_pending_delivery/)
  assert.match(platform, /terminalError/)
  assert.match(platform, /\.context-tokens\.json/)
  assert.match(platform, /plain_text == "\[SILENT\]"/)
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

test('Hermes platform suppresses sentinels, passes real text to secondary and preserves fallback errors', () => {
  const root = mkdtempSync(join(tmpdir(), 'xiuqiu-radar-platform-'))
  const platform = new URL('../ops/hermes/market-radar-weixin/platform.py', import.meta.url).pathname
  const python = String.raw`
import asyncio, importlib.util, json, sys, types
from pathlib import Path

calls = []
pending = {"value": None}

class Platform:
    def __init__(self, name): self.name = name

class BasePlatformAdapter:
    def __init__(self, config, platform):
        self.config = config
        self.platform = platform

class SendResult:
    def __init__(self, success, error=None, message_id=None):
        self.success = success
        self.error = error
        self.message_id = message_id

async def send_weixin_direct(**kwargs):
    calls.append(kwargs)
    return {"success": True, "message_id": "fixture-message"}

gateway = types.ModuleType("gateway"); gateway.__path__ = []
gateway_config = types.ModuleType("gateway.config"); gateway_config.Platform = Platform
gateway_platforms = types.ModuleType("gateway.platforms"); gateway_platforms.__path__ = []
gateway_base = types.ModuleType("gateway.platforms.base")
gateway_base.BasePlatformAdapter = BasePlatformAdapter; gateway_base.SendResult = SendResult
gateway_weixin = types.ModuleType("gateway.platforms.weixin"); gateway_weixin.send_weixin_direct = send_weixin_direct
for name, module in {
    "gateway": gateway, "gateway.config": gateway_config, "gateway.platforms": gateway_platforms,
    "gateway.platforms.base": gateway_base, "gateway.platforms.weixin": gateway_weixin,
}.items(): sys.modules[name] = module

package = types.ModuleType("radar_plugin"); package.__path__ = []
common = types.ModuleType("radar_plugin.common")
common.classify_weixin_error = lambda value: ("weixin_send_failed", "safe failure")
common.forget_pending_delivery = lambda reference: None
common.load_pending_delivery = lambda reference: pending["value"]
common.local_delivery_options = lambda: ("radar-secondary", 35.0)
common.post = lambda *args, **kwargs: {}
common.read_ledger = lambda spec: {}
common.remember_connection_test = lambda message_id: None
common.remember_delivery = lambda *args: None
common.remember_pending_failure = lambda *args: None
common.settings = lambda: ("https://example.invalid", "fixture-token", "fixture-chat", False)
market = types.ModuleType("radar_plugin.dispatcher")
market.SPEC = types.SimpleNamespace(name="market-radar", recipient_aliases=("primary", "secondary"), ack_path="/ack")
learning = types.ModuleType("radar_plugin.learning_dispatcher")
learning.SPEC = types.SimpleNamespace(name="learning-radar", recipient_aliases=("primary",), ack_path="/ack")
for name, module in {
    "radar_plugin": package, "radar_plugin.common": common,
    "radar_plugin.dispatcher": market, "radar_plugin.learning_dispatcher": learning,
}.items(): sys.modules[name] = module

spec = importlib.util.spec_from_file_location("radar_plugin.platform", sys.argv[1])
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)

account_dir = Path.home() / ".hermes" / "profiles" / "radar-secondary" / "weixin" / "accounts"
account_dir.mkdir(parents=True)
(account_dir / "primary.json").write_text(json.dumps({
    "token": "fixture-secondary-token", "user_id": "fixture-secondary-user",
}), encoding="utf-8")
(account_dir / "primary.context-tokens.json").write_text("{}", encoding="utf-8")
(account_dir / "primary.sync.json").write_text("{}", encoding="utf-8")
assert module._secondary_credentials("radar-secondary")["account_id"] == "primary"

config = types.SimpleNamespace()
adapter = module.RadarWeixinAdapter(config)

async def verify():
    before = len(calls)
    silent = await adapter.send("fixture-primary", "[SILENT]")
    blank = await adapter.send("fixture-primary", "   ")
    assert silent.success and blank.success and len(calls) == before
    plain = await adapter.send("fixture-primary", "真实晨报")
    assert plain.success and calls[-1]["message"] == "真实晨报"
    pending["value"] = {"terminalError": "weixin_rate_limited: safe retry"}
    failed = await adapter.send("fixture-primary", json.dumps({
        "version": 1, "mode": "deliver", "deliveryRef": "fixture_reference_1234567890",
    }))
    assert not failed.success and failed.error == "weixin_rate_limited: safe retry"

asyncio.run(verify())
`
  execFileSync('python3', ['-c', python, platform], { env: { ...process.env, HOME: root } })
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
