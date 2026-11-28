import { evaluationMatrix, expansionChanges, failedQuestions, filterFailures, methodName } from './model.js'

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

function resultsTable(caption, columns, rows) {
  return el('table', 'matrix-table',
    el('caption', '', caption),
    el('thead', '', el('tr', '', ...columns.map(label => header('col', label)))),
    el('tbody', '', ...rows.map(([method, ...values]) => el('tr', '',
      header('row', methodName(method)), ...values.map(value => el('td', '', value))))))
}

function matrixTable(cutoff, rows) {
  return resultsTable(`查看前 ${cutoff} 个片段的评测结果`, ['切块与检索方式', `Recall@${cutoff}`, 'MRR'],
    rows.map(({ method, baseline: { recall, mrr } }) => [method, recall.toFixed(4), mrr.toFixed(5)]))
}

function comparisonTable(label, cutoff, rows) {
  const scores = ({ recall, mrr }) => el('div', 'comparison-scores',
    el('span', '', `Recall@${cutoff} ${recall.toFixed(4)}`), el('span', '', `MRR ${mrr.toFixed(5)}`))
  return resultsTable(`${label}：查看前 ${cutoff} 个片段`, ['切块与检索方式', '关闭扩展', '开启扩展'],
    rows.map(({ method, baseline, expanded }) => [method, scores(baseline), scores(expanded)]))
}

function chunkList(chunks) {
  return el('ol', 'citations', ...chunks.map(chunk => el('li', '',
    el('p', 'muted', `${chunk.id}${chunk.title_path.length ? ` · ${chunk.title_path.join(' / ')}` : ''}`),
    el('blockquote', '', chunk.text))))
}

function failureView({ method, reason, cutoffs, chunks }) {
  return el('div', 'failure',
    el('h4', '', methodName(method)),
    el('p', '', `失败原因：${reason}。查看前 ${cutoffs.join('、')} 个片段时未命中。`),
    el('p', '', `排名前 ${chunks.length} 的检索片段：`), chunkList(chunks))
}

function questionDetails({ id, question, gold, failures }) {
  return el('details', 'card case',
    el('summary', '', `失败题目：${id} ${question}`),
    el('div', 'case-body',
      el('h3', '', '标准原句'), el('blockquote', '', gold),
      el('h3', '', '未命中的设置'), ...failures.map(failureView)))
}

function changeDetails({ id, question, gold, changes }, group) {
  const rank = value => value === null ? '未找到完整原句' : `第 ${value} 名`
  return el('details', 'card case',
    el('summary', '', `${group}：${id} ${question}`),
    el('div', 'case-body',
      el('p', '', '标准原句'), el('blockquote', '', gold),
      ...changes.map(({ method, before, after, cutoffs, displacing }) => el('div', 'failure',
        el('h4', '', methodName(method)),
        el('p', '', `关闭扩展时${rank(before)}，开启后${rank(after)}。查看前 ${cutoffs.join('、')} 个片段时受到影响。`),
        ...(displacing.size ? [el('p', '', '开启后超过标准原句的片段'), chunkList([...displacing.values()])] : [])))))
}

function showExpansion(bundle, matrix) {
  const { improved, worsened } = expansionChanges(bundle)
  byId('expansion-description').textContent =
    `在 ${bundle.questions.length} 道原有题上，用同一检索设置对比关闭和开启扩展。开启时，把同义词加到原问题里，新增词的权重是 ${bundle.expansion_weight}。`
  byId('expansion-matrix').replaceChildren(...Array.from(matrix,
    ([cutoff, rows]) => comparisonTable('原有题', cutoff, rows)))
  for (const [target, group, questions] of [
    ['improved', '变好的题目', improved], ['worsened', '变差的题目', worsened],
  ]) {
    byId(target).replaceChildren(...(questions.length
      ? questions.map(question => changeDetails(question, group)) : [el('p', '', '无')]))
  }
  byId('expansion').hidden = false

  const { questions, configs } = bundle.held_out
  byId('held-out-description').textContent = `下面是单独评测的 ${questions.length} 道留出题的结果。`
  byId('held-out-matrix').replaceChildren(...Array.from(evaluationMatrix(configs),
    ([cutoff, rows]) => comparisonTable('留出题', cutoff, rows)))
  byId('held-out').hidden = false
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
    const [, , cutoff, mode] = config.split('/')
    byId('recommended-setting').textContent =
      `${methodName(config)}，查看前 ${cutoff} 个片段，${mode ? '开启' : '关闭'}同义词扩展。`
    byId('recommendation-reason').textContent = reason
    byId('recommendation').hidden = false

    const questions = failedQuestions(bundle)
    const filter = byId('failure-reason')
    const reasons = new Set(questions.flatMap(question => question.failures.map(failure => failure.reason)))
    for (const reason of reasons) filter.add(new Option(reason, reason))
    let renderedFailures = new Map()
    function renderFailures() {
      const shown = filterFailures(questions, filter.value)
      renderedFailures = new Map(shown.map(question => {
        const details = questionDetails(question)
        details.open = renderedFailures.get(question.id)?.open ?? false
        return [question.id, details]
      }))
      byId('failures').replaceChildren(...renderedFailures.values())
      status.textContent = `${filter.value || '全部原因'}，共 ${shown.length} 道失败题目。`
    }
    filter.addEventListener('change', renderFailures)
    byId('filters').disabled = false
    renderFailures()

    if (bundle.held_out) showExpansion(bundle, matrix)

    const provenance = byId('source')
    provenance.append('数据来源：', bundle.source.repo, '，提交 ', el('code', '', bundle.source.commit), '。')
    provenance.hidden = false
  } catch {
    status.textContent = '评测数据加载失败。请刷新页面重试。'
  }
}

start()
