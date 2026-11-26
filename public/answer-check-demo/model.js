export const LABEL_NAMES = Object.freeze({
  WRONG_FACT: '事实不对',
  NO_CITATION: '没给出处',
  BAD_CITATION: '出处不支持',
  MISSED_HANDOFF: '该转人工没转',
  NEEDLESS_HANDOFF: '不该转人工却转了',
  OVERPROMISE: '乱承诺',
  PRIVACY_LEAK: '泄露隐私',
})

export const CATEGORY_NAMES = Object.freeze({
  fact: '单条事实',
  multi_fact: '多条事实',
  out_of_scope: '超出知识库',
  handoff: '转人工',
  policy_edge: '规则边界',
  privacy: '隐私',
  injection: '试图绕过规则',
})

export const VERDICT_NAMES = Object.freeze({ pass: '通过', fail: '不通过' })

export function caseView(bundle, bot, item) {
  const { answers, report, labels } = bundle.bots[bot]
  const answer = answers.find(row => row.case_id === item.id)
  const check = report.cases.find(row => row.case_id === item.id)
  const label = labels.find(row => row.case_id === item.id)
  const checkerCodes = new Set(check.reasons.map(reason => reason.label))
  const labelCodes = new Set(label.reasons)
  const reasonDifferences = [...new Set([...checkerCodes, ...labelCodes])]
    .filter(code => checkerCodes.has(code) !== labelCodes.has(code))

  return {
    id: item.id,
    question: item.question,
    category: item.category,
    categoryName: CATEGORY_NAMES[item.category],
    answer: answer.answer,
    handoff: answer.handoff,
    citations: answer.citations.map(id => ({ id, text: bundle.passages[id] })),
    check: {
      verdict: check.verdict,
      reasons: check.reasons.map(({ label: code, detail }) => ({ name: LABEL_NAMES[code], detail })),
    },
    label: { verdict: label.verdict, reasons: label.reasons.map(code => LABEL_NAMES[code]) },
    verdictAgrees: check.verdict === label.verdict,
    reasonDifferences,
  }
}

export function filterCases(bundle, { bot, verdict = '', category = '', disagreementsOnly = false }) {
  return bundle.cases
    .filter(item => !category || item.category === category)
    .map(item => caseView(bundle, bot, item))
    .filter(item => (!verdict || item.check.verdict === verdict) &&
      (!disagreementsOnly || item.reasonDifferences.length > 0))
}

export function compareReports(base, next) {
  const baseVerdicts = new Map(base.cases.map(row => [row.case_id, row.verdict]))
  let improved = 0
  let regressed = 0
  for (const row of next.cases) {
    const previous = baseVerdicts.get(row.case_id)
    if (previous === 'fail' && row.verdict === 'pass') improved += 1
    if (previous === 'pass' && row.verdict === 'fail') regressed += 1
  }
  return { improved, regressed }
}

export function agreementView(bundle, bot) {
  const agree = bundle.bots[bot].agree
  // 一致性报告只记录有分歧的标签及其次数，逐题记录补足题号。
  const differingCodes = Object.keys(agree.per_reason).filter(code => {
    const { checker_only, labels_only } = agree.per_reason[code]
    return checker_only > 0 || labels_only > 0
  })
  const reasonCases = bundle.cases.map(item => caseView(bundle, bot, item))
    .filter(item => item.reasonDifferences.some(code => differingCodes.includes(code)))
  return { ...agree, reasonCases }
}
