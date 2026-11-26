import {
  agreementView, CATEGORY_NAMES, compareReports, filterCases, LABEL_NAMES, VERDICT_NAMES,
} from './model.js'

const byId = id => document.getElementById(id)
const botSelect = byId('bot')
const verdictSelect = byId('verdict')
const categorySelect = byId('category')
const disagreements = byId('disagreements')
const resultCount = byId('result-count')

function el(tag, className, ...children) {
  const node = document.createElement(tag)
  if (className) node.className = className
  for (const child of children) node.append(child instanceof Node ? child : String(child))
  return node
}

function facts(items) {
  return el('dl', 'facts', ...items.map(([name, value]) =>
    el('div', 'fact', el('dt', '', name), el('dd', '', value))))
}

function scoreCard(bot, { total, pass, by_reason: counts }) {
  return el('article', 'card round', el('h3', '', bot),
    el('p', 'score', `${total} 题里通过 `, el('strong', '', pass), ' 题'),
    facts(Object.entries(LABEL_NAMES).map(([code, name]) => [name, counts[code]])))
}

function percent(value) {
  return value === null ? '无可计算样本' : `${Number((value * 100).toFixed(1))}%`
}

function agreementCard(bot, { confusion, precision, recall }) {
  return el('article', 'card round', el('h3', '', bot), facts([
    ['两边都判不通过', confusion.both_fail],
    ['只有质检判不通过', confusion.checker_only_fail],
    ['只有标注判不通过', confusion.labels_only_fail],
    ['两边都判通过', confusion.both_pass],
    ['精确率', percent(precision)],
    ['召回率', percent(recall)],
  ]))
}

function caseDetails(item) {
  const summary = el('summary', '', el('span', 'case-id', item.id), `，${item.question}`,
    el('span', 'case-meta', `${item.categoryName} · 质检${VERDICT_NAMES[item.check.verdict]}`))
  const citations = item.citations.length > 0
    ? el('ul', 'citations', ...item.citations.map(({ id, text }) => el('li', '',
      el('span', 'case-id', id), el('blockquote', '', text ?? '知识库中没有这段出处。'))))
    : el('p', '', '没给出处。')
  const checkReasons = item.check.reasons.length > 0
    ? el('ul', '', ...item.check.reasons.map(({ name, detail }) => el('li', '', el('strong', '', name), `。${detail}`)))
    : el('p', '', '没有不通过的原因。')
  const labelReasons = item.label.reasons.join('、') || '没有不通过的原因'
  const agreement = `判定${item.verdictAgrees ? '一致' : '不一致'}，原因${item.reasonDifferences.length ? '不一致' : '一致'}。`

  return el('details', 'card case', summary, el('div', 'case-body',
    el('h3', '', '机器人回答'), el('p', 'answer', item.answer),
    el('p', 'muted', item.handoff ? '已转人工。' : '未转人工。'),
    el('h3', '', '引用的知识库原文'), citations,
    el('h3', '', `质检结果：${VERDICT_NAMES[item.check.verdict]}`), checkReasons,
    el('h3', '', `独立标注：${VERDICT_NAMES[item.label.verdict]}`), el('p', '', `${labelReasons}。`),
    el('p', 'agreement', agreement)))
}

function renderOverview(bundle) {
  const entries = Object.entries(bundle.bots)
  byId('scores').replaceChildren(...entries.map(([bot, { report }]) => scoreCard(bot, report.summary)))
  const { naive, careful } = bundle.bots
  const { improved, regressed } = compareReports(naive.report, careful.report)
  const comparison = byId('comparison')
  comparison.textContent = `从 naive 换到 careful：修好 ${improved} 题，退步 ${regressed} 题。`
  comparison.hidden = false

  const agreements = entries.map(([bot]) => [bot, agreementView(bundle, bot)])
  byId('agreement').replaceChildren(...agreements.map(([bot, view]) => agreementCard(bot, view)))
  const matching = agreements.reduce((sum, [, { confusion }]) => sum + confusion.both_fail + confusion.both_pass, 0)
  const answers = entries.reduce((sum, [, { report }]) => sum + report.summary.total, 0)
  const note = byId('agreement-note')
  note.append(el('p', '', `这组数据里，${answers} 个回答中有 ${matching} 个的通过判定一致。`))
  for (const [bot, { reasonCases }] of agreements) {
    if (reasonCases.length === 0) continue
    note.append(el('p', '', `${bot} 有 ${reasonCases.length} 道题的原因有分歧。质检逐字比对回答或引用，漏认了意思相近的表达。`),
      el('ul', '', ...reasonCases.map(item => el('li', '', el('span', 'case-id', item.id), `，${item.question}`))))
  }
  note.hidden = false

  const source = byId('source')
  source.append('数据来源：', bundle.source.repo, '，提交 ', el('code', '', bundle.source.commit), '。')
  source.hidden = false
}

function renderCases(bundle) {
  const bot = botSelect.value
  const cases = filterCases(bundle, {
    bot,
    verdict: verdictSelect.value,
    category: categorySelect.value,
    disagreementsOnly: disagreements.checked,
  })
  byId('cases').replaceChildren(...cases.map(caseDetails))
  resultCount.textContent = cases.length > 0
    ? `${bot}：找到 ${cases.length} 道题。`
    : `${bot}：找到 0 道题。没有符合筛选条件的题目。`
}

async function start() {
  resultCount.textContent = '正在加载演示数据。'
  try {
    const response = await fetch(new URL('./data/bundle.json', import.meta.url))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const bundle = await response.json()
    for (const [value, name] of Object.entries(CATEGORY_NAMES)) {
      categorySelect.add(new Option(name, value))
    }
    renderOverview(bundle)
    renderCases(bundle)
    byId('filters').addEventListener('change', () => renderCases(bundle))
    byId('filter-controls').disabled = false
  } catch {
    resultCount.textContent = '演示数据加载失败。请刷新页面重试。'
  }
}

start()
