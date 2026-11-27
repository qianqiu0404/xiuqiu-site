import { ALERT_NAMES, filterAlerts } from './model.js'

const byId = id => document.getElementById(id)
const alertType = byId('alert-type')
const resultCount = byId('result-count')
const overviewStatus = byId('overview-status')

const metrics = [
  ['calls', '调用数'],
  ['success_rate', '成功率', value => `${Number((value * 100).toFixed(1))}%`],
  ['timeouts', '超时数'],
  ['errors', '错误数'],
  ['p50_ms', '延迟 p50（毫秒）'],
  ['p95_ms', '延迟 p95（毫秒）'],
  ['tokens_in', '输入 token'],
  ['tokens_out', '输出 token'],
]
const statusNames = { ok: '成功', timeout: '超时', error: '错误' }

function el(tag, className, ...children) {
  const node = document.createElement(tag)
  if (className) node.className = className
  for (const child of children) node.append(child instanceof Node ? child : String(child))
  return node
}

function tableHeader(scope, label) {
  const header = el('th', '', label)
  header.setAttribute('scope', scope)
  return header
}

function summaryTable(title, groups) {
  const entries = Object.entries(groups)
  const head = el('tr', '', tableHeader('col', '指标'), ...entries.map(([id]) => tableHeader('col', id)))
  const rows = metrics.map(([key, label, format = String]) =>
    el('tr', '', tableHeader('row', label), ...entries.map(([, stats]) =>
      el('td', '', stats[key] === null ? '无' : format(stats[key])))))
  return el('table', 'card usage-table', el('caption', '', title), el('thead', '', head), el('tbody', '', ...rows))
}

function timestamp(value) {
  const time = el('time', '', value)
  time.setAttribute('datetime', value)
  return time
}

function traceRecord(record) {
  const fields = [
    ['时间', timestamp(record.ts)],
    ['用户', record.user],
    ['模型', record.model],
    ['状态', statusNames[record.status]],
    ['延迟（毫秒）', record.latency_ms],
    ['输入 token', record.tokens_in],
    ['输出 token', record.tokens_out],
  ]
  return el('li', '',
    el('p', '', el('strong', '', `请求编号 ${record.request_id}`)),
    el('dl', 'facts', ...fields.map(([name, value]) => el('div', 'fact', el('dt', '', name), el('dd', '', value)))))
}

function alertDetails(alert) {
  const summary = el('summary', '', el('span', 'case-id', ALERT_NAMES[alert.type]),
    `，${alert.model ?? alert.user}，`, timestamp(alert.ts))
  const details = el('details', 'card case', summary)
  const body = el('div', 'case-body')
  if (alert.type === 'budget_exceeded') {
    body.append(el('p', '', `${alert.date} 累计使用 ${alert.tokens} token，当日预算为 ${alert.budget} token。`))
  }
  const recordsById = new Map(alert.records.map(record => [record.request_id, record]))
  body.append(el('h3', '', '按请求编号查到的调用记录'),
    el('ul', 'trace-records', ...alert.request_ids.map(id => traceRecord(recordsById.get(id)))))
  details.append(body)
  return details
}

function renderAlerts(alerts) {
  const filtered = filterAlerts(alerts, alertType.value)
  byId('alerts').replaceChildren(...filtered.map(alertDetails))
  resultCount.textContent = filtered.length
    ? `找到 ${filtered.length} 条事件。`
    : '找到 0 条事件。没有符合筛选条件的事件。'
}

async function start() {
  overviewStatus.textContent = '正在加载演示数据。'
  try {
    const response = await fetch(new URL('./data/bundle.json', import.meta.url))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const { source, alerts, summary } = await response.json()
    const calls = Object.values(summary.by_user).reduce((total, row) => total + row.calls, 0)
    byId('overview').replaceChildren(
      summaryTable('按用户汇总', summary.by_user),
      summaryTable('按模型汇总', summary.by_model),
    )
    overviewStatus.textContent = `共 ${calls} 次有效调用，另有 ${summary.bad_lines} 行格式有误。`

    for (const [value, name] of Object.entries(ALERT_NAMES)) alertType.add(new Option(name, value))
    renderAlerts(alerts)
    byId('filters').addEventListener('change', () => renderAlerts(alerts))
    byId('filter-controls').disabled = false

    const provenance = byId('source')
    provenance.append('数据来源：', source.repo, '，提交 ', el('code', '', source.commit), '。')
    provenance.hidden = false
  } catch {
    overviewStatus.textContent = '演示数据加载失败。请刷新页面重试。'
  }
}

start()
