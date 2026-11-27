const byId = id => document.getElementById(id)
const resultCount = byId('result-count')

const preferenceNames = { order_filter: '订单筛选', brevity: '回答长短', salutation: '称呼' }
const preferenceValues = {
  order_filter: { unshipped: '只看未发货订单', shipped: '只看已发货订单' },
  brevity: { short: '简短', long: '详细' },
}

function el(tag, className, ...children) {
  const node = document.createElement(tag)
  if (className) node.className = className
  for (const child of children) node.append(child instanceof Node ? child : String(child))
  return node
}

function storedPreferences(account, preferences) {
  const entries = Object.entries(preferences)
  if (!entries.length) return el('p', '', `账户 ${account} 没有已保存的偏好。`)
  return el('dl', 'facts', ...entries.map(([key, { value, written_at: writtenAt }]) =>
    el('div', 'fact', el('dt', '', preferenceNames[key]),
      el('dd', '', preferenceValues[key]?.[value] ?? value, '。写入时间 ', el('time', '', writtenAt)))))
}

function stepDetails({ input, answer, preferences }, index) {
  const { account, command, session, message } = input
  const label = command === 'chat'
    ? `账户 ${account} 在会话 ${session} 说：“${message}”`
    : `账户 ${account} 执行清除全部偏好的命令（独立于会话）`
  const summary = el('summary', '', el('span', 'case-id', `第 ${index + 1} 步`), `，${label}`)
  const replyTitle = command === 'chat' ? '客服回复' : '命令结果'
  return el('details', 'card case', summary, el('div', 'case-body',
    el('h3', '', replyTitle), el('p', 'answer', answer),
    el('h3', '', '这一步之后保存的偏好'), storedPreferences(account, preferences)))
}

async function start() {
  resultCount.textContent = '正在加载演示数据。'
  try {
    const response = await fetch(new URL('./data/bundle.json', import.meta.url))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const { source, steps } = await response.json()
    byId('steps').replaceChildren(...steps.map(stepDetails))
    resultCount.textContent = steps.length ? `共 ${steps.length} 步。` : '没有可展示的步骤。'

    const provenance = byId('source')
    provenance.append('数据来源：', source.repo, '，提交 ', el('code', '', source.commit), '。')
    provenance.hidden = false
  } catch {
    resultCount.textContent = '演示数据加载失败。请刷新页面重试。'
  }
}

start()
