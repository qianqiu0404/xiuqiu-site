const byId = id => document.getElementById(id)

const toolNames = { lookup_order: '查订单', list_orders: '列出订单', change_address: '改地址', refund: '退款' }
const riskNames = { read: '只读', low: '低风险', high: '高风险' }
const parameterNames = { order_id: '订单号', account: '账户', new_address: '新地址', amount: '退款金额（元）' }

// The export does not store the original prompt. These are the demo inputs,
// with the address displayed using the same mask as the exported plan.
const requests = {
  '正常查单': '查订单 A-101',
  改地址: 'A-101 改地址 青柚路***',
  退款审批: '我的订单 A-102 退款 199 元',
  重复批准: '我的订单 A-102 退款 199 元',
  超时后查询确认: '我的订单 A-101 退款 39 元',
  越权被拒: '查订单 B-201',
  坏计划被拒: '坏计划',
  大额退款双人审批: 'A-103 退款 600 元',
}

const scenarioDescriptions = {
  可疑订单备注: '测试脚本先查订单 B-202 和 B-203，再尝试用 B-203 的订单备注作为退款金额。',
  每分钟工具限额: '在同一分钟查订单 A-101 共 11 次。',
  分钟限额重置: '下一分钟再查订单 A-101。',
  每日退款限额: '当天为订单 B-201 连续发起 3 笔 10 元退款。',
  每日限额重置: '次日为订单 B-201 退款 10 元。',
}

const accountBScenarios = new Set(['demo-injection', 'demo-day-limit', 'demo-day-reset'])

function el(tag, className, ...children) {
  const node = document.createElement(tag)
  if (className) node.className = className
  for (const child of children) node.append(child instanceof Node ? child : String(child))
  return node
}

function facts(items) {
  return el('dl', 'facts', ...items.map(([label, value]) =>
    el('div', 'fact', el('dt', '', label), el('dd', '', value))))
}

function resultText({ result, status, error }) {
  if (error) return `${status}。原因：${error}。`
  if (result?.refunded_cents !== undefined) return `已退款 ${result.refunded_cents / 100} 元。`
  if (result?.address_changed) return '地址已更新。'
  if (result?.paid_cents !== undefined) {
    return `实付 ${result.paid_cents / 100} 元，${result.shipped ? '已发货' : '未发货'}。`
  }
  return `${status}。`
}

function stepView(step, events, duplicateApprovalStatus) {
  const parameters = Object.entries(step.params)
    .map(([key, value]) => `${parameterNames[key] ?? key}：${value}`).join('，')
  const approval = { '已批准': '人工已批准', '已拒绝': '人工已拒绝', '待审': '等待人工审批' }
  const approvalState = approval[step.approval] ?? step.approval ?? (
    !step.risk || (step.risk === 'high' && step.error) ? '工具已拦下，未进入审批' : '无需审批')
  const item = el('li', '', el('p', '', el('strong', '', toolNames[step.tool] ?? `未开放的工具 ${step.tool}`)),
    facts([
      ['工具', step.tool],
      ['参数', parameters || '无'],
      ['风险级别', riskNames[step.risk] ?? '未评级'],
      ['审批状态', approvalState],
      ['结果', resultText(step)],
      ...(step.flags?.length ? [['标记', step.flags.join('、')]] : []),
    ]))
  if (step.approvals_required > 1) {
    item.append(el('p', '', `这笔退款需要 ${step.approvals_required} 位不同的人批准。`))
    const firstVote = events.find(event => event.approvals_received === 1)
    if (firstVote) item.append(el('p', '', `第一位批准后，状态为${firstVote.status}。`))
    if (duplicateApprovalStatus) item.append(el('p', '', `同一人重复批准后，状态仍为${duplicateApprovalStatus}。`))
    item.append(el('p', '', `共收到 ${step.approvals_received} 位审批人的批准。${resultText(step)}`))
  } else if (step.approval === '已批准' && step.error === '该账户每天最多退款 2 次') {
    item.append(el('p', '', '人工已批准，当日额度已用完，本笔未退款。'))
  } else if (events.some(event => event.approval === '待审')) {
    item.append(el('p', '', '退款先进入待审，人工批准后才执行。'))
  }
  if (events.some(event => event.status === '结果不明') && step.source === '幂等查询') {
    item.append(el('p', '', '执行超时，退款结果一度不明。系统先按原操作编号查询，确认已退款，这一步没有重试。'))
  }
  return item
}

function scenarioDetails({ name, run_id, status, steps, events, refund_count, duplicate_approval_status }) {
  const account = accountBScenarios.has(run_id) ? 'B' : 'A'
  const description = scenarioDescriptions[name]
  const introduction = description
    ? `场景说明（账户 ${account}）：${description}`
    : `用户请求（账户 ${account}）：“${requests[name]}”`
  const body = el('div', 'case-body',
    el('p', '', introduction),
    el('p', 'muted', `运行号：${run_id}`),
    el('h3', '', `${name}：工具调用计划`),
    el('ol', '', ...steps.map(step => stepView(step, events.filter(event => event.step === step.step), duplicate_approval_status))))
  if (refund_count === 1) {
    body.append(el('p', '', '人工对同一步重复批准，系统返回原结果。账上只有 1 笔退款，没有退第二次。'))
  }
  body.append(el('p', '', el('strong', '', `最终状态：${status}。`)))
  return el('details', 'card case', el('summary', '', name), body)
}

async function start() {
  const status = byId('result-count')
  status.textContent = '正在加载演示数据。'
  try {
    const response = await fetch(new URL('./data/bundle.json', import.meta.url))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const { source, scenarios, m2_scenarios } = await response.json()
    const allScenarios = [...scenarios, ...m2_scenarios]
    byId('scenarios').replaceChildren(...allScenarios.map(scenarioDetails))
    status.textContent = allScenarios.length ? `共 ${allScenarios.length} 个场景。` : '没有可展示的场景。'
    const provenance = byId('source')
    provenance.append('数据来源：', source.repo, '，提交 ', el('code', '', source.commit), '。')
    provenance.hidden = false
  } catch {
    status.textContent = '演示数据加载失败。请刷新页面重试。'
  }
}

start()
