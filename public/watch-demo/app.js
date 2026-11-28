import { ALERT_NAMES, filterAlerts } from './model.js'
import { calendarDate, timestamp } from './timestamp.js'

const byId = id => document.getElementById(id)
const alertType = byId('alert-type')
const resultCount = byId('result-count')
const overviewStatus = byId('overview-status')
let renderedAlerts = new Map()

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
const formatCost = value => typeof value === 'number' ? `${value.toFixed(4)} 元` : (value ?? '无数据')
const reportMetrics = [
  ['calls', '调用数'],
  ['p95_ms', '延迟 p95（毫秒）'],
  ['success_rate', '成功率', value => `${(value * 100).toFixed(2)}%`],
  ['cost', '费用', formatCost],
  ['tokens_in', '输入 token'],
  ['tokens_out', '输出 token'],
  ['unpriced_model_count', '未定价模型数'],
]

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

function summaryTable(title, groups, tableMetrics = metrics, columnLabel = String) {
  const entries = Object.entries(groups)
  const head = el('tr', '', tableHeader('col', '指标'), ...entries.map(([id]) => tableHeader('col', columnLabel(id))))
  const rows = tableMetrics.map(([key, label, format = String]) =>
    el('tr', '', tableHeader('row', label), ...entries.map(([, stats]) =>
      el('td', '', stats[key] === null ? '无' : format(stats[key])))))
  return el('table', 'card usage-table', el('caption', '', title), el('thead', '', head), el('tbody', '', ...rows))
}

function costTable(title, groupName, groups, showUnpricedModels = false) {
  const entries = Object.entries(groups)
  if (!entries.length) return el('p', '', `${title}：没有费用记录。`)
  const headers = [tableHeader('col', groupName), tableHeader('col', '费用')]
  if (showUnpricedModels) headers.push(tableHeader('col', '未定价模型'))
  const rows = entries.map(([name, stats]) => {
    const row = el('tr', '', tableHeader('row', name), el('td', '', formatCost(stats.cost)))
    if (showUnpricedModels) row.append(el('td', '', stats.unpriced_models?.join('、') || '无'))
    return row
  })
  return el('table', 'card usage-table', el('caption', '', title),
    el('thead', '', el('tr', '', ...headers)), el('tbody', '', ...rows))
}

function reportView(report) {
  if (!report) return el('p', '', '没有可展示的日报。')
  const { date, metrics, comparison } = report
  const days = { [date]: metrics }
  if (comparison.previous) days[comparison.previous_date] = comparison.previous
  return el('div', '',
    el('p', '', '与前一天比较：', comparison.message || comparison.flags.join('、') || '无指标超过门槛', '。'),
    summaryTable('日报指标', days, reportMetrics, calendarDate))
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
    body.append(el('p', '', calendarDate(alert.date), `累计使用 ${alert.tokens} token，当日预算为 ${alert.budget} token。`))
  }
  const recordsById = new Map(alert.records.map(record => [record.request_id, record]))
  body.append(el('h3', '', '按请求编号查到的调用记录'),
    el('ul', 'trace-records', ...alert.request_ids.map(id => traceRecord(recordsById.get(id)))))
  details.append(body)
  return details
}

function renderAlerts(alerts) {
  const type = alertType.value
  const filtered = filterAlerts(alerts, type)
  renderedAlerts = new Map(filtered.map(alert => {
    const details = alertDetails(alert)
    details.open = renderedAlerts.get(alert)?.open ?? false
    return [alert, details]
  }))
  byId('alerts').replaceChildren(...renderedAlerts.values())
  const count = `${ALERT_NAMES[type] ?? '全部类型'}，共 ${filtered.length} 条事件。`
  resultCount.textContent = filtered.length ? count : `${count}没有符合筛选条件的事件。`
}

async function start() {
  overviewStatus.textContent = '正在加载演示数据。'
  try {
    const response = await fetch(new URL('./data/bundle.json', import.meta.url))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const { source, alerts, summary, report } = await response.json()
    const calls = Object.values(summary.by_user).reduce((total, row) => total + row.calls, 0)
    byId('overview').replaceChildren(
      summaryTable('按用户汇总', summary.by_user),
      summaryTable('按模型汇总', summary.by_model),
    )
    byId('cost').replaceChildren(
      costTable('按用户看费用', '用户', summary.by_user, true),
      costTable('按模型看费用', '模型', summary.by_model),
    )
    byId('report').replaceChildren(reportView(report))
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
