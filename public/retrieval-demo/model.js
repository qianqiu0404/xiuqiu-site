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
  for (const [key, baseline] of Object.entries(configs)) {
    const [chunking, retriever, cutoff, mode] = key.split('/')
    if (mode) continue
    if (!tables.has(cutoff)) tables.set(cutoff, [])
    tables.get(cutoff).push({ method: `${chunking}/${retriever}`, baseline, expanded: configs[`${key}/expanded`] })
  }
  return tables
}

export function failedQuestions(bundle) {
  return bundle.questions.flatMap(question => {
    const failures = new Map()
    for (const [key, { results }] of Object.entries(bundle.configs)) {
      const [chunking, retriever, cutoff, mode] = key.split('/')
      if (mode) continue
      const { diagnosis, top } = results[question.id]
      if (!diagnosis) continue
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

export function expansionChanges({ questions, configs, chunks }) {
  const improved = []
  const worsened = []
  const matrix = evaluationMatrix(configs)
  for (const question of questions) {
    const better = new Map()
    const worse = new Map()
    for (const [cutoff, rows] of matrix) {
      for (const { method, baseline, expanded } of rows) {
        const before = baseline.results[question.id]
        const after = expanded.results[question.id]
        const oldRank = before.rank !== null && before.rank <= Number(cutoff) ? before.rank : Infinity
        const newRank = after.rank !== null && after.rank <= Number(cutoff) ? after.rank : Infinity
        if (oldRank === newRank) continue

        const changes = newRank < oldRank ? better : worse
        if (!changes.has(method)) {
          changes.set(method, { method, before: before.rank, after: after.rank, cutoffs: [], displacing: new Map() })
        }
        const change = changes.get(method)
        change.cutoffs.push(cutoff)
        if (changes === worse) {
          const [chunking] = method.split('/')
          const oldAhead = new Set(before.top.slice(0, before.rank - 1).map(hit => hit.chunk))
          for (const { chunk } of after.top.slice(0, after.rank === null ? undefined : after.rank - 1)) {
            if (!oldAhead.has(chunk)) change.displacing.set(chunk, { id: chunk, ...chunks[chunking][chunk] })
          }
        }
      }
    }
    if (better.size) improved.push({ ...question, changes: [...better.values()] })
    if (worse.size) worsened.push({ ...question, changes: [...worse.values()] })
  }
  return { improved, worsened }
}

export function filterFailures(questions, reason) {
  return questions.flatMap(question => {
    const failures = question.failures.filter(failure => !reason || failure.reason === reason)
    return failures.length ? [{ ...question, failures }] : []
  })
}
