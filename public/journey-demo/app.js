const byId = id => document.getElementById(id)

const stepNames = { memory: '记忆', retrieve: '检索', draft: '起草', check: '质检', act: '办理', watch: '监控' }
const outcomeNames = {
  done: '已完成', passed: '已通过', blocked: '已拦截', refused: '已拒绝',
  failed: '失败', pending_approval: '待审批',
}
const preferences = { brevity: '答复长度', order_filter: '订单筛选' }
const scenarioName = scenario => `场景 ${scenario.id} · ${scenario.title}`

function el(tag, className, ...children) {
  const node = document.createElement(tag)
  if (className) node.className = className
  node.append(...children)
  return node
}

function stepView(step, records, passages, check) {
  const section = el('section', 'journey-step', el('h4', '', stepNames[step]))
  if (!records.length) {
    section.append(el('p', 'muted', '未运行。'))
    return section
  }

  for (const record of records) {
    let summary = record.summary
    if (record.phase === 'approval') {
      summary = summary.replace(/\d+\/\d+ 票/u, `${record.approvals_received} 票，共需 ${record.approvals_required} 票`)
    }
    if (record.step === 'act') {
      summary = summary.replace(/(\d+) 分/u, (_, cents) => `${Number(cents) / 100} 元`)
    }
    if (record.kind === 'model') {
      summary += `。调用编号 ${record.request_id}`
    }
    section.append(el('p', '', `${summary}。`))
  }

  const [first] = records
  if (first.preference_keys?.length) {
    section.append(el('p', 'muted', `偏好：${first.preference_keys.map(key => preferences[key] ?? key).join('、')}。`))
  }
  if (first.hits?.length) {
    section.append(el('ol', 'policy-passages', ...first.hits.map(hit =>
      el('li', '', el('p', '', `政策段落 ${hit.passage_id}`),
        el('blockquote', '', passages[hit.passage_id])))))
  }
  if (step === 'draft') {
    section.append(check?.reply
      ? el('p', 'draft-text', `草稿内容：${check.reply}`)
      : el('p', 'muted', '导出记录未公开草稿正文。'))
  }
  return section
}

function permissionText({ steps, final }, check) {
  const actions = steps.filter(record => record.step === 'act')
  const approval = actions.find(record => record.phase === 'approval' && record.outcome === 'passed')
  if (final.approved_refund_count > 1) return `批准了 ${final.approved_refund_count} 笔退款，每笔都审批通过。`
  if (approval) return `审批通过，收到 ${approval.approvals_received} 票，共需 ${approval.approvals_required} 票。`
  if (actions.some(record => record.phase === 'guard' && record.outcome === 'refused')) {
    return '查单已获准，退款被拦下。'
  }
  if (final.outcome === 'pending_approval') return '待审批。'
  if (actions.some(record => record.kind === 'tool' && record.outcome === 'done')) return '本次请求获准执行。'
  if (check?.verdict === 'blocked') return '质检拦截，未进入办理。'
  return '未进入办理。'
}

function resultView(scenario) {
  const { steps, final } = scenario
  const check = steps.findLast(record => record.step === 'check')
  const citation = check ? (check.verdict === 'passed' ? '质检通过。' : `${check.summary}。`) : '未质检。'
  const refund = final.refund_count
    ? `已退 ${final.refund_count} 笔，共 ${final.refunded_cents / 100} 元。` : '没有退款。'
  const address = final.address_change_completed ? '已收到改址成功回执。' : '没有改址成功回执。'
  const order = final.order_changed ? '订单地址字段已变更。' : '订单地址字段未变更。'
  const actualResult = final.stop_step === 'memory' && final.reply ? `${final.reply}。` : `${address}${refund}`
  return el('section', 'card result-card', el('h3', '', '结果'),
    el('p', '', el('strong', '', '引用正确：'), citation),
    el('p', '', el('strong', '', '允许办理：'), permissionText(scenario, check)),
    el('p', '', el('strong', '', '实际办成：'), actualResult),
    el('p', 'final-result',
      `停在哪一步、有没有改订单或退钱：停在${stepNames[final.stop_step]}（${outcomeNames[final.outcome]}）。${order}${refund}`))
}

function monitoringView({ steps, alerts }) {
  const record = steps.find(step => step.step === 'watch')
  const section = el('section', 'monitoring', el('h3', '', '监控'),
    el('p', '', record ? `${record.summary}。` : '未运行。'))
  if (alerts.length) {
    section.append(el('ul', '', ...alerts.map(alert => {
      const detail = alert.type === 'slow_call'
        ? `慢调用告警：耗时 ${alert.latency_ms} 毫秒，超过 ${alert.threshold_ms} 毫秒门槛`
        : `告警：${alert.type}`
      return el('li', '', `${detail}。调用编号 ${alert.request_ids.join('、')}。`)
    })))
  }
  return section
}

function showScenario(content, scenario, passages) {
  const turns = scenario.messages.map((message, index) => {
    const records = scenario.steps.filter(step => step.turn === index + 1 && step.step !== 'watch')
    const check = records.find(record => record.step === 'check')
    return el('section', 'journey-turn', el('h3', '', `第 ${index + 1} 轮`),
      el('p', 'turn-request', `客户请求：${message}。`),
      ...['memory', 'retrieve', 'draft', 'check', 'act'].map(step =>
        stepView(step, records.filter(record => record.step === step), passages, check)))
  })
  content.replaceChildren(el('h2', '', scenarioName(scenario)), ...turns, monitoringView(scenario), resultView(scenario))
  content.hidden = false
}

async function start() {
  const status = byId('load-status')
  status.textContent = '正在加载演示数据。'
  try {
    const response = await fetch(new URL('./data/bundle.json', import.meta.url))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const { source, scenarios, passages } = await response.json()
    if (!scenarios.length) {
      status.textContent = '没有可展示的场景。'
      return
    }

    const picker = byId('scenario-picker')
    const content = byId('scenario-content')
    for (const scenario of scenarios) picker.add(new Option(scenarioName(scenario), String(scenario.id)))
    picker.value = String(scenarios[0].id)
    showScenario(content, scenarios[0], passages)
    picker.addEventListener('change', () => {
      const scenario = scenarios.find(item => String(item.id) === picker.value)
      if (!scenario) return
      showScenario(content, scenario, passages)
      status.textContent = `已切换到场景 ${scenario.id}，${scenario.title}。`
    })
    const provenance = byId('source')
    provenance.append('数据来源：', source.repo, '，提交 ', el('code', '', source.commit), '。')
    provenance.hidden = false
    picker.disabled = false
    byId('scenario-controls').hidden = false
    status.textContent = `已加载 ${scenarios.length} 个场景。`
  } catch {
    status.textContent = '演示数据加载失败。请刷新页面重试。'
  }
}

start()
