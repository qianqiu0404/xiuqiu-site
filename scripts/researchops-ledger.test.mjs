import assert from 'node:assert/strict'
import test from 'node:test'
import { renderResearchSource, validateResearchOpsLedger } from './prepare-researchops-source.mjs'

const item = (lane, title, sourceUrl) => ({
  lane,
  title,
  sourceUrl,
  primarySource: true,
  publishedAt: '2026-08-10T01:00:00+08:00',
  checkedAt: '2026-08-10T05:45:00+08:00',
  verificationNotes: '已打开一手页面，核对版本、发布时间、机制说明与限制条件。',
})

const base = {
  version: 1,
  date: '2026-08-10',
  timezone: 'Asia/Shanghai',
  runKey: 'learning-radar/2026-08-10',
  items: [
    item('marketSignals', '钱包信号一号版本更新', 'https://github.com/example/wallet/releases/tag/v1.0.0'),
    item('aiEngineering', 'AI 工程可靠性更新', 'https://openai.com/index/example-ai-engineering/'),
    item('toolProject', '工具项目一号发布', 'https://github.com/example/tool/releases/tag/v2.0.0'),
  ],
}

test('accepts one idempotent ledger with at least three public sections', () => {
  const result = validateResearchOpsLedger(base, [])
  assert.equal(result.itemCount, 3)
  assert.deepEqual(result.sections, ['crypto', 'radar', 'vibe'])
  assert.match(renderResearchSource(base), /<!-- crypto:start -->/)
})

test('stops duplicate, aggregator-only, and over-limit items', () => {
  assert.throws(() => validateResearchOpsLedger({ ...base, items: [...base.items, base.items[0]] }, []), /duplicates/)
  assert.throws(() => validateResearchOpsLedger({ ...base, items: [
    item('marketSignals', '钱包信号一号版本更新', 'https://aihot.virxact.com/items/1'),
    ...base.items.slice(1),
  ] }, []), /discovery-only/)
  const fourMarketSignals = Array.from({ length: 4 }, (_, index) => item('marketSignals', `钱包信号版本更新第${index}项`, `https://github.com/example/wallet-${index}/releases/tag/v1`))
  assert.throws(() => validateResearchOpsLedger({ ...base, items: [...fourMarketSignals, ...base.items.slice(1)] }, []), /marketSignals exceeds/)
})

test('stops URLs and titles used in the prior 30 days', () => {
  const history = [{
    date: '2026-08-01',
    urls: ['https://github.com/example/wallet/releases/tag/v1.0.0'],
    titles: ['钱包信号一号版本更新'],
  }]
  assert.throws(() => validateResearchOpsLedger(base, history), /previous 30 days/)
})

test('AI Hot is discovery-only and only allowed for AI Engineering', () => {
  const discovered = {
    ...base,
    items: base.items.map(entry => entry.lane === 'aiEngineering'
      ? { ...entry, discoveredVia: 'https://aihot.virxact.com/api/v1/items?id=example' }
      : entry),
  }
  assert.doesNotThrow(() => validateResearchOpsLedger(discovered, []))
  assert.throws(() => validateResearchOpsLedger({
    ...base,
    items: base.items.map(entry => entry.lane === 'marketSignals'
      ? { ...entry, discoveredVia: 'https://aihot.virxact.com/api/v1/items?id=example' }
      : entry),
  }, []), /not allowed for this lane/)
})

test('timestamps must represent a same-day verification after publication', () => {
  assert.throws(() => validateResearchOpsLedger({
    ...base,
    items: base.items.map((entry, index) => index === 0 ? { ...entry, checkedAt: '2026-08-11T05:45:00+08:00' } : entry),
  }, []), /ledger date/)
  assert.throws(() => validateResearchOpsLedger({
    ...base,
    items: base.items.map((entry, index) => index === 0 ? { ...entry, publishedAt: '2026-08-10T06:00:00+08:00' } : entry),
  }, []), /later than checkedAt/)
})
