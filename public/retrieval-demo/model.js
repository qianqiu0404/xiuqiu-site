const chunkingNames = {
  heading: '按标题切块',
  'fixed-200-0': '每 200 字切块，无重叠',
  'fixed-200-50': '每 200 字切块，重叠 50 字',
}

const retrieverNames = { bm25: 'BM25', bigram: '相邻两字匹配' }

export function methodName(method) {
  const [chunking, retriever] = method.split('/')
  return `${chunkingNames[chunking]} · ${retrieverNames[retriever]}`
}

export function evaluationMatrix(configs) {
  const tables = new Map()
  for (const [key, { recall, mrr }] of Object.entries(configs)) {
    const [chunking, retriever, cutoff] = key.split('/')
    if (!tables.has(cutoff)) tables.set(cutoff, [])
    tables.get(cutoff).push({ method: `${chunking}/${retriever}`, recall, mrr })
  }
  return tables
}

export function failedQuestions(bundle) {
  return bundle.questions.flatMap(question => {
    const failures = new Map()
    for (const [key, { results }] of Object.entries(bundle.configs)) {
      const { diagnosis, top } = results[question.id]
      if (!diagnosis) continue
      const [chunking, retriever, cutoff] = key.split('/')
      const method = `${chunking}/${retriever}`
      // The smaller cutoffs show prefixes of the same ranking.
      const group = `${method}/${diagnosis.reason}`
      if (!failures.has(group)) failures.set(group, { method, reason: diagnosis.reason, cutoffs: [], chunks: [] })
      const failure = failures.get(group)
      failure.cutoffs.push(Number(cutoff))
      if (top.length > failure.chunks.length) {
        failure.chunks = top.map(({ chunk }) => ({ id: chunk, ...bundle.chunks[chunking][chunk] }))
      }
    }
    return failures.size ? [{ ...question, failures: [...failures.values()] }] : []
  })
}

export function filterFailures(questions, reason) {
  return questions.flatMap(question => {
    const failures = question.failures.filter(failure => !reason || failure.reason === reason)
    return failures.length ? [{ ...question, failures }] : []
  })
}
