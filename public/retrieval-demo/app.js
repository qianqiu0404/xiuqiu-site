import { evaluationMatrix, failedQuestions, filterFailures, methodName } from './model.js'

const byId = id => document.getElementById(id)

function el(tag, className, ...children) {
  const node = document.createElement(tag)
  if (className) node.className = className
  for (const child of children) node.append(child instanceof Node ? child : String(child))
  return node
}

function header(scope, label) {
  const th = el('th', '', label)
  th.setAttribute('scope', scope)
  return th
}

function matrixTable(cutoff, rows) {
  return el('table', 'matrix-table',
    el('caption', '', `查看前 ${cutoff} 个片段的评测结果`),
    el('thead', '', el('tr', '', header('col', '切块与检索方式'), header('col', `Recall@${cutoff}`), header('col', 'MRR'))),
    el('tbody', '', ...rows.map(({ method, recall, mrr }) => el('tr', '',
      header('row', methodName(method)), el('td', '', recall.toFixed(4)), el('td', '', mrr.toFixed(5))))))
}

function failureView({ method, reason, cutoffs, chunks }) {
  return el('div', 'failure',
    el('h4', '', methodName(method)),
    el('p', '', `失败原因：${reason}。查看前 ${cutoffs.join('、')} 个片段时未命中。`),
    el('p', '', `排名前 ${chunks.length} 的检索片段：`),
    el('ol', 'citations', ...chunks.map(chunk => el('li', '',
      el('p', 'muted', `${chunk.id}${chunk.title_path.length ? ` · ${chunk.title_path.join(' / ')}` : ''}`),
      el('blockquote', '', chunk.text)))))
}

function questionDetails({ id, question, gold, failures }) {
  return el('details', 'card case',
    el('summary', '', `${id} ${question}`),
    el('div', 'case-body',
      el('h3', '', '标准原句'), el('blockquote', '', gold),
      el('h3', '', '未命中的设置'), ...failures.map(failureView)))
}

async function start() {
  const status = byId('result-count')
  status.textContent = '正在加载评测数据。'
  try {
    const response = await fetch(new URL('./data/bundle.json', import.meta.url))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const bundle = await response.json()
    const matrix = evaluationMatrix(bundle.configs)
    if (!matrix.size) {
      status.textContent = '没有可展示的评测结果。'
      return
    }
    byId('matrix').replaceChildren(...Array.from(matrix, ([cutoff, rows]) => matrixTable(cutoff, rows)))
    const { config, reason } = bundle.recommendation
    byId('recommended-setting').textContent = `${methodName(config)}，查看前 ${config.split('/')[2]} 个片段。`
    byId('recommendation-reason').textContent = reason
    byId('recommendation').hidden = false

    const questions = failedQuestions(bundle)
    const filter = byId('failure-reason')
    const reasons = new Set(questions.flatMap(question => question.failures.map(failure => failure.reason)))
    for (const reason of reasons) filter.add(new Option(reason, reason))
    function renderFailures() {
      const shown = filterFailures(questions, filter.value)
      byId('failures').replaceChildren(...shown.map(questionDetails))
      status.textContent = `${filter.value || '全部原因'}，共 ${shown.length} 道失败题目。`
    }
    filter.addEventListener('change', renderFailures)
    byId('filters').disabled = false
    renderFailures()

    const provenance = byId('source')
    provenance.append('数据来源：', bundle.source.repo, '，提交 ', el('code', '', bundle.source.commit), '。')
    provenance.hidden = false
  } catch {
    status.textContent = '评测数据加载失败。请刷新页面重试。'
  }
}

start()
