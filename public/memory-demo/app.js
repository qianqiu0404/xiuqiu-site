const byId = id => document.getElementById(id)
const resultCount = byId('result-count')

const preferenceNames = { order_filter: '订单筛选', brevity: '回答长短', salutation: '称呼' }
const preferenceValues = {
  order_filter: { unshipped: '只看未发货订单', shipped: '只看已发货订单' },
  brevity: { short: '简短', long: '详细' },
}
const auditActions = { read: '读取', write: '写入', delete: '删除' }
const historyTokenLimit = 400

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

function consentView({ consent, first_answer, same_session_answer, new_session_answer, preferences }) {
  return el('div', 'card case-body',
    el('p', '', `账户 ${consent.account} 的跨会话偏好保存：${consent.enabled ? '开启' : '关闭'}。`),
    el('p', '', consent.answer),
    el('p', '', `跨会话保存的偏好：${Object.keys(preferences).length} 项。`),
    el('h3', '', '说「以后只看未发货的」之后'), el('p', 'answer', first_answer),
    el('h3', '', '在同一会话再次查询'), el('p', 'answer', same_session_answer),
    el('h3', '', '换到新会话再查询'), el('p', 'answer', new_session_answer))
}

function historyView({ account, session, turns, summary }) {
  const used = Math.ceil([...JSON.stringify({ turns, summary })].length / 2)
  return el('div', 'card case-body',
    el('p', '', `账户 ${account} 的会话 ${session} 保留了最近 ${turns.length} 轮对话和 ${summary.length} 条摘要。`),
    el('p', '', `按字符数估算共用 ${used} 个 token，上限 ${historyTokenLimit} 个。`),
    el('h3', '', '较早的对话摘要'),
    summary.length ? el('ul', '', ...summary.map(({ user }) => el('li', '', user))) : el('p', '', '没有摘要。'),
    el('h3', '', '最近的对话'),
    turns.length ? el('ol', '', ...turns.map(({ user, reply }) => el('li', '',
      el('p', '', `顾客：${user}`), el('p', 'answer', `客服：${reply}`)))) : el('p', '', '没有对话。'))
}

function auditView(entries) {
  if (!entries.length) return el('p', '', '没有读写记录。')
  return el('div', 'card case-body',
    el('p', '', `共 ${entries.length} 条。每条记录只列时间、操作、账户、会话和偏好名称。`),
    el('ul', '', ...entries.map(({ account, session, key, action, time }) => {
      const timestamp = el('time', '', time)
      timestamp.setAttribute('datetime', time)
      return el('li', '', timestamp, `，${auditActions[action]}，账户 ${account}，`,
        session === null ? '无指定会话' : `会话 ${session}`, `，${preferenceNames[key]}`)
    })))
}

async function start() {
  resultCount.textContent = '正在加载演示数据。'
  try {
    const response = await fetch(new URL('./data/bundle.json', import.meta.url))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const { source, steps, m2 } = await response.json()
    byId('steps').replaceChildren(...steps.map(stepDetails))
    byId('consent').replaceChildren(m2 ? consentView(m2) : el('p', '', '没有同意开关记录。'))
    byId('history').replaceChildren(m2 ? historyView(m2.history) : el('p', '', '没有对话记录。'))
    byId('audit').replaceChildren(auditView(m2?.audit ?? []))
    resultCount.textContent = steps.length ? `共 ${steps.length} 步。` : '没有可展示的步骤。'

    const provenance = byId('source')
    provenance.append('数据来源：', source.repo, '，提交 ', el('code', '', source.commit), '。')
    provenance.hidden = false
  } catch {
    resultCount.textContent = '演示数据加载失败。请刷新页面重试。'
  }
}

start()
