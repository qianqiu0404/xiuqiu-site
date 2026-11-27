import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { isUtf8 } from 'node:buffer'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { isIP } from 'node:net'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'
import { parse, NodeTypes } from '@vue/compiler-dom'
import { renderToString } from '@vue/server-renderer'
import vue from '@vitejs/plugin-vue'
import { createServer } from 'vite'
import { createSSRApp, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { agreementView, compareReports, filterCases, LABEL_NAMES } from '../public/answer-check-demo/model.js'
import { filterAlerts } from '../public/watch-demo/model.js'
import {
  adjacentProjectId, filterResumeProjects, normalizeCategory, projectIdFromHash,
} from '../src/features/resume/presentation.ts'

const resumeDir = new URL('../src/features/resume/', import.meta.url)
const publicDir = new URL('../public/', import.meta.url)
const records = JSON.parse(readFileSync(new URL('records.json', resumeDir)))
const demoHref = '/mini-exchange-demo/index.html'
const demoDataPrefix = 'window.DEMO_DATA = JSON.parse('
const answerCheckDir = new URL('answer-check-demo/', publicDir)
const memoryDir = new URL('memory-demo/', publicDir)
const watchDir = new URL('watch-demo/', publicDir)
const readBundle = dir => JSON.parse(readFileSync(new URL('data/bundle.json', dir), 'utf8'))
const answerCheckBundle = readBundle(answerCheckDir)
const memoryBundle = readBundle(memoryDir)
const watchBundle = readBundle(watchDir)
let page
let notes
let router
let onDialogKey

before(async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    configFile: false,
    plugins: [vue()],
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, ws: false, watch: null },
    appType: 'custom',
  })
  try {
    const { default: ResumePage } = await server.ssrLoadModule('/src/features/resume/pages/ResumePage.vue')
    const { useResume } = await server.ssrLoadModule('/src/features/resume/useResume.ts')
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: ResumePage, alias: ['/intel', '/radar', '/articles'] }],
    })
    const app = createSSRApp({
      setup() {
        onDialogKey = useResume().onDialogKey
        return () => h(ResumePage)
      },
    }).use(router)
    await router.push('/')
    page = parse(await renderToString(app), { parseMode: 'html' })

    // The dialog loads these HTML fragments on mount in the browser.
    const { loadProjectNotes } = await server.ssrLoadModule('/src/features/resume/data.ts')
    notes = await loadProjectNotes()
  } finally {
    await server.close()
  }
})

function attribute(element, name) {
  return element?.props?.find(prop => prop.type === NodeTypes.ATTRIBUTE && prop.name === name)?.value?.content
}

function elements(node, matches) {
  return (node?.children ?? [])
    .filter(child => child.type === NodeTypes.ELEMENT)
    .flatMap(child => [...(matches(child) ? [child] : []), ...elements(child, matches)])
}

function withClass(name) {
  return node => attribute(node, 'class')?.split(/\s+/).includes(name)
}

function textOf(node, skipHidden = false) {
  if (!node || (skipHidden && attribute(node, 'aria-hidden') === 'true')) return ''
  if (node.type === NodeTypes.TEXT) return node.content
  return node.children?.map(child => textOf(child, skipHidden)).join('') ?? ''
}

function text(node, skipHidden = false) {
  return textOf(node, skipHidden).replace(/\s+/g, ' ').trim()
}

function section(id) {
  const [element] = elements(page, node => node.tag === 'section' && attribute(node, 'id') === id)
  assert.ok(element, `Missing #${id} section`)
  return element
}

function featuredCards() {
  return elements(section('selected'), withClass('selected-card'))
}

function featuredTitleButton(card) {
  const [heading] = elements(card, node => node.tag === 'h3')
  const buttons = elements(heading, node => node.tag === 'button')
  assert.equal(buttons.length, 1)
  return buttons[0]
}

function featuredCard(id) {
  const card = featuredCards().find(card => attribute(featuredTitleButton(card), 'data-open') === id)
  assert.ok(card, `Missing featured card for ${id}`)
  return card
}

function assertDemoLink(container) {
  const links = elements(container, node => node.tag === 'a' && attribute(node, 'href') === demoHref)
  assert.equal(links.length, 1, 'Expected one real link to the bundled demo')
  assert.equal(text(links[0]), '打开诊断演示 ↗')
  assert.equal(text(links[0], true), '打开诊断演示')
}

function readFiles(dir) {
  const root = fileURLToPath(dir)
  return new Map(readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => {
      const path = join(entry.parentPath, entry.name)
      const bytes = readFileSync(path)
      const content = !bytes.includes(0) && isUtf8(bytes) ? bytes.toString('utf8') : null
      return [relative(root, path), content]
    }))
}

function parseDemoData(source) {
  const script = source.trimEnd()
  assert.ok(script.startsWith(demoDataPrefix) && script.endsWith(');'), 'Invalid demo data.js wrapper')
  return JSON.parse(JSON.parse(script.slice(demoDataPrefix.length, -2)))
}

// Minimal document for running the bundled demo scripts without a browser dependency.
class DemoNode {
  children = []
  dataset = {}
  attributes = new Map()

  constructor(tag, value) {
    this.tag = tag
    this.value = value
  }

  get textContent() {
    return this.value ?? this.children.map(child => child.textContent).join(' ')
  }

  set textContent(value) { this.value = value }
  setAttribute(name, value) { this.attributes.set(name, value) }
  append(...children) { this.children.push(...children) }
  replaceChildren(...children) { this.children = children }
  addEventListener() {}

  descendants() {
    return this.children.flatMap(child => [child, ...child.descendants()])
  }

  querySelector(tag) {
    return this.descendants().find(node => node.tag === tag)
  }
}

function renderDemoRoute(hash) {
  const dir = new URL('mini-exchange-demo/', publicDir)
  const html = parse(readFileSync(new URL('index.html', dir), 'utf8'), { parseMode: 'html' })
  const app = new DemoNode('main')
  const entry = { app, banner: new DemoNode('p'), skip: new DemoNode('a') }
  const context = createContext({
    Node: DemoNode,
    window: { location: { hash }, addEventListener() {} },
    document: {
      getElementById: id => entry[id],
      createElement: tag => new DemoNode(tag),
      createTextNode: value => new DemoNode('#text', value),
    },
  })
  for (const script of elements(html, node => node.tag === 'script')) {
    const src = attribute(script, 'src')
    runInContext(readFileSync(new URL(src, dir), 'utf8'), context, { filename: src })
  }
  return app
}

function assertDemoFiles(files) {
  function requireFile(path) {
    assert.ok(files.has(path), `Missing demo file: ${path}`)
    return files.get(path)
  }
  const entry = 'index.html'
  const html = parse(requireFile(entry), { parseMode: 'html' })
  const pageUrl = new URL(`https://example.invalid${demoHref}`)
  const demoPath = new URL('.', pageUrl).pathname
  for (const node of elements(html, node => ['script', 'link', 'object'].includes(node.tag))) {
    const attributeName = { script: 'src', link: 'href', object: 'data' }[node.tag]
    const reference = attribute(node, attributeName)
    if (!reference) continue
    const url = new URL(reference, pageUrl)
    assert.ok(url.origin === pageUrl.origin && url.pathname.startsWith(demoPath), `Demo asset must be bundled: ${reference}`)
    requireFile(decodeURIComponent(url.pathname.slice(demoPath.length)))
  }

  const indexPath = 'data/index.json'
  const index = JSON.parse(requireFile(indexPath))
  const bundled = parseDemoData(requireFile('data.js'))
  assert.deepEqual(bundled.index, index, 'Demo data.js index differs from data/index.json')
  for (const scenario of index.scenarios) {
    for (const example of scenario.cases) {
      for (const { file } of example.runs) {
        const saved = JSON.parse(requireFile(`data/${file}`))
        assert.ok(Object.hasOwn(bundled.runs, file), `Missing bundled demo replay: ${file}`)
        assert.deepEqual(bundled.runs[file], saved, `Bundled demo replay differs from data/${file}`)
      }
    }
  }
}

function assertPublicPrivacy(files) {
  const rules = [
    ['local absolute path', /(?:file:\/\/|~\/(?:\.[\w-]+|[\w-]+)\/|\/(?:Users|Volumes|home|private|opt|tmp|var|root|etc|mnt|srv|usr)\/[^\s/<>"`\\]+|\b[a-z]:[\\/]+[\w.-]+(?:[\\/]+[\w .-]+)+)/i],
    ['local hostname', /\blocalhost\b|\b(?:[a-z0-9-]+\.)+(?:local|internal|lan|corp|home\.arpa)\b|(?:https?|wss?):\/\/[a-z][a-z0-9-]*(?=[:/?#\s"'`<>\\]|$)/i],
    ['one-off authorization note', /仅限本卡|(?:Owner|负责人)\s*(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s*)?(?:(?:事先|先|提前|另行)\s*)?(?:批准|授权)|(?:批准|授权)[^\n\\]{0,24}(?:仅限|只限|本卡|本次)/i],
  ]
  const findings = []
  for (const [path, value] of files) {
    if (value === null) continue
    for (const [label, pattern] of rules) {
      if (pattern.test(value)) findings.push(`${path}: ${label}`)
    }
    const addresses = value.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b|(?<![\w:])[a-f\d.]*:[a-f\d:.]+/gi) ?? []
    if (addresses.some(address => isIP(address))) findings.push(`${path}: IP address`)
  }
  assert.deepEqual(findings, [], `Public privacy check failed:\n${findings.join('\n')}`)
}

test('reviewed catalog is complete and every record has a public summary', () => {
  assert.equal(records.length, 29)
  assert.equal(new Set(records.map(project => project.id)).size, 29)
  assert.deepEqual(Object.keys(notes).sort(), records.map(project => project.id).sort())
  assert.deepEqual(records.filter(project => project.kind === 'team').map(project => project.id).sort(), ['qai', 'saas', 'theai'])
})

test('category, historical visibility and search compose without changing catalog order', () => {
  assert.deepEqual(filterResumeProjects(records, 'all', true, ''), records)
  const engineering = filterResumeProjects(records, 'engineering', false, '')
  assert.ok(engineering.length > 0)
  assert.ok(engineering.every(project => project.category === 'engineering' && !project.history))
  assert.deepEqual(filterResumeProjects(records, 'all', true, '私有').map(project => project.id), ['wildheart'])
  assert.deepEqual(filterResumeProjects(records, 'all', true, '团队业务').map(project => project.id).sort(), ['qai', 'saas', 'theai'])
  assert.ok(filterResumeProjects(records, 'all', true, ' TYPESCRIPT ').length > 0)
  assert.deepEqual(filterResumeProjects(records, 'engineering', true, '知识地图'), [])
  assert.deepEqual(filterResumeProjects(records, 'all', true, 'unmatched-search-query'), [])
})

test('shared filters and detail hashes accept only known keys, including malformed encodings', () => {
  assert.equal(normalizeCategory('engineering', records), 'engineering')
  for (const category of [undefined, ['engineering'], 'unknown', '<script>']) assert.equal(normalizeCategory(category, records), 'all')
  assert.equal(projectIdFromHash('#project/wildheart', records), 'wildheart')
  assert.equal(projectIdFromHash('#project/%73aas', records), 'saas')
  for (const hash of ['#catalog', '#project/missing', '#project/%zz', '#project/__proto__']) assert.equal(projectIdFromHash(hash, records), null)
})

test('detail navigation wraps in the same order as the complete catalog', () => {
  assert.equal(adjacentProjectId(records, records[0].id, -1), records.at(-1).id)
  assert.equal(adjacentProjectId(records, records.at(-1).id, 1), records[0].id)
  assert.equal(adjacentProjectId(records, records[2].id, 1), records[3].id)
  assert.equal(adjacentProjectId([], '', 1), '')
})

test('rendered reading routes expose the section and topics as headings', () => {
  const tracks = elements(page, withClass('tracks'))[0]
  assert.ok(tracks)
  assert.deepEqual(
    elements(tracks, node => /^h[1-6]$/.test(node.tag)).map(node => [node.tag, text(node, true)]),
    [
      ['h2', '一条主线'],
      ['h3', '1回答有依据'],
      ['h3', '2出了问题查得出'],
      ['h3', '3用量管得住'],
      ['h3', '4进展看得见'],
      ['h2', '另外两个方向'],
      ['h3', '交易与资金链路'],
      ['h3', '工具与创作'],
    ],
  )
})

test('map arrow keys leave scrolling to the browser and preserve the current project', async t => {
  // The handler can navigate through openProject, which checks the DOM element type.
  if (typeof HTMLElement === 'undefined') {
    globalThis.HTMLElement = class {}
    t.after(() => { delete globalThis.HTMLElement })
  }
  await router.push('/#project/wildheart')
  const replace = t.mock.method(router, 'replace')
  const map = elements(parse(notes.wildheart, { parseMode: 'html' }), withClass('km-scroll'))[0]
  assert.equal(attribute(map, 'tabindex'), '0')
  const mapTarget = {
    closest: selectors => selectors.split(',').some(selector =>
      selector.startsWith('.') && withClass(selector.slice(1))(map)) ? map : null,
  }
  for (const key of ['ArrowRight', 'ArrowLeft']) {
    const event = new Event('keydown', { cancelable: true })
    Object.defineProperties(event, { key: { value: key }, target: { value: mapTarget } })
    onDialogKey(event)
    assert.equal(event.defaultPrevented, false, key + ' should be available for scrolling')
  }
  assert.equal(replace.mock.callCount(), 0)
  assert.equal(router.currentRoute.value.hash, '#project/wildheart')

  const next = new Event('keydown', { cancelable: true })
  Object.defineProperties(next, { key: { value: 'ArrowRight' }, target: { value: { closest: () => null } } })
  onDialogKey(next)
  assert.equal(next.defaultPrevented, true)
  assert.equal(replace.mock.callCount(), 1)
  await replace.mock.calls[0].result
  assert.equal(router.currentRoute.value.hash, '#project/research')
})

test('resume features eight catalog entries in the approved order', () => {
  const cards = featuredCards()
  assert.deepEqual(cards.map(card => attribute(featuredTitleButton(card), 'data-open')), [
    'saas', 'miniexchange', 'qai', 'steward', 'xiaomao', 'qiumarket', 'wildheart', 'qiwu',
  ])
  assert.deepEqual(cards.map(card => {
    const [meta] = elements(card, withClass('card-meta'))
    return text(meta.children.find(child => child.tag === 'span'))
  }), [
    '01 / 08', '02 / 08', '03 / 08', '04 / 08', '05 / 08', '06 / 08', '07 / 08', '08 / 08',
  ])
})

test('hero and tracks tell one storyline: four facets in order, each opening its projects', () => {
  const [hero] = elements(page, withClass('hero'))
  assert.equal(text(elements(hero, node => node.tag === 'h2')[0]), '让 AI Agent 在真实业务里靠得住。')
  assert.equal(text(elements(hero, withClass('intro'))[0]), '回答有依据，出了问题查得出，用量管得住，进展看得见。')
  const [tracks] = elements(page, withClass('tracks'))
  assert.equal(text(elements(tracks, node => attribute(node, 'id') === 'tracks-title')[0]), '一条主线')
  const [mainline] = elements(tracks, withClass('mainline-grid'))
  const facets = elements(mainline, withClass('track')).map(facet => ({
    title: text(elements(facet, withClass('track-head'))[0]),
    opens: elements(facet, node => node.tag === 'button').map(button => attribute(button, 'data-open')),
    links: elements(facet, node => node.tag === 'a').map(link => [attribute(link, 'href'), text(link)]),
  }))
  assert.deepEqual(facets, [
    { title: '1回答有依据', opens: ['saas'], links: [
      ['/answer-check-demo/index.html', '客服回答质检演示个人项目'],
      ['/memory-demo/index.html', '客服记忆演示个人项目'],
    ] },
    { title: '2出了问题查得出', opens: ['miniexchange'], links: [] },
    { title: '3用量管得住', opens: ['qai'], links: [['/watch-demo/index.html', 'AI 调用监测演示个人项目']] },
    { title: '4进展看得见', opens: ['steward', 'xiaomao'], links: [] },
  ])
  for (const facet of facets) {
    for (const [href] of facet.links) assert.ok(existsSync(new URL(`.${href}`, publicDir)), `missing ${href}`)
  }
  const ids = new Set(records.map(record => record.id))
  const others = elements(tracks, withClass('other-grid'))[0]
  for (const button of elements(tracks, node => node.tag === 'button')) assert.ok(ids.has(attribute(button, 'data-open')), attribute(button, 'data-open'))
  assert.deepEqual(elements(others, withClass('track-head')).map(head => text(head)), ['A交易与资金链路', 'B工具与创作'])
})

test('work history lists Tianjin GenHash and only its three résumé entries', () => {
  const experience = section('experience')
  const [list] = elements(experience, withClass('experience-list'))
  assert.deepEqual(elements(list, node => ['h3', 'h4'].includes(node.tag)).map(node => text(node)), [
    '天津根哈希 · 后端开发（AI 应用 / 交易系统）',
    'Agent SaaS · 企业客服 Agent',
    'QAI · 团队内部模型中转站',
    'chooseme · 预测市场交易撮合',
  ])
  assert.doesNotMatch(text(experience), /The AI/)
  assert.deepEqual(elements(list, withClass('experience-when')).map(node => text(node)), ['2025.07 — 2026.11'])
  assert.deepEqual(elements(list, withClass('experience-result')).map(node => text(node)), [
    '结果 约两周内 5 个 PR 合入主干',
    '结果 两周交付，团队内部在用',
    '结果 撮合引擎随 chooseme 上线',
  ])
  for (const entry of elements(list, withClass('experience-row'))) {
    const bullets = elements(entry, node => node.tag === 'li')
    assert.ok(bullets.length >= 2 && bullets.length <= 4)
  }
  const source = readFileSync(new URL('pages/ResumePage.vue', resumeDir), 'utf8')
  for (const placeholder of ['待补充', '待本人确认']) {
    assert.ok(!source.includes(placeholder))
    assert.ok(!text(experience).includes(placeholder))
  }
  const [heroFacts] = elements(page, withClass('hero-facts'))
  assert.ok(elements(heroFacts, node => node.tag === 'dd').some(node => text(node) === '已离职 · 随时到岗'))
})

test('diagnosis featured card links to the bundled demo', () => {
  const card = featuredCard('miniexchange')
  assertDemoLink(card)
  assert.equal(text(elements(card, withClass('card-status'))[0]), '两轮真实模型评测 · 有在线演示')
})

test('diagnosis detail links to the bundled demo', () => {
  assertDemoLink(parse(notes.miniexchange, { parseMode: 'html' }))
  assertDemoFiles(readFiles(new URL('./mini-exchange-demo/', publicDir)))
})

test('real case run 3 links include the question and retain their record destinations', () => {
  const app = renderDemoRoute('#/real')
  assert.equal(app.querySelector('h1').textContent, '实战案例')
  const nodes = app.descendants()
  const byId = new Map(nodes.filter(node => node.id).map(node => [node.id, node]))
  const cases = [
    ['#/real/real-order-ok/3', /订单.*第 3 次.*通过.*没有问题/],
    ['#/real/real-funds-ok/3', /余额.*第 3 次.*通过.*没有问题/],
  ]
  for (const [href, expectedName] of cases) {
    const links = nodes.filter(node => node.tag === 'a' && node.href === href)
    assert.equal(links.length, 1, href)
    const [link] = links
    const references = link.attributes.get('aria-labelledby')
    // These links use plain text and ID references, including a reference to the link itself.
    const name = references
      ? references.split(/\s+/).map(id => byId.get(id)?.textContent ?? '').join(' ')
      : link.textContent
    assert.match(name, expectedName, href)
  }
})

test('demo link check rejects a fixture with docs.js removed', () => {
  const fixture = readFiles(new URL('./mini-exchange-demo/', publicDir))
  assert.ok(fixture.delete('docs.js'))
  assert.throws(() => assertDemoFiles(fixture), /Missing demo file: docs\.js/)
})

test('demo replay check rejects a replay missing only from data.js', () => {
  const fixture = readFiles(new URL('./mini-exchange-demo/', publicDir))
  const data = parseDemoData(fixture.get('data.js'))
  const file = 'runs/round1/price_not_reached-1-1.json'
  assert.ok(fixture.has(`data/${file}`))
  assert.ok(Object.hasOwn(data.runs, file))
  delete data.runs[file]
  fixture.set('data.js', `${demoDataPrefix}${JSON.stringify(JSON.stringify(data))});\n`)
  assert.throws(() => assertDemoFiles(fixture), { message: `Missing bundled demo replay: ${file}` })
})

test('answer-check demo passes the public-file privacy checks', () => {
  assertPublicPrivacy(readFiles(answerCheckDir))
})

test('memory and watch demos pass the public-file privacy checks', () => {
  const memoryFiles = readFiles(memoryDir)
  assertPublicPrivacy(memoryFiles)
  assertPublicPrivacy(readFiles(watchDir))
  assert.doesNotMatch(memoryFiles.get('data/bundle.json'), /(?<!\d)1[3-9]\d{9}(?!\d)/u)
})

test('memory bundle matches the six-step source export and masks the sample phone', () => {
  const { source, steps } = memoryBundle
  assert.deepEqual(source, { repo: 'support-memory', commit: 'b5283a5' })
  assert.deepEqual(steps.map(({ input }) => [input.account, input.session, input.command]), [
    ['A', 'a1', 'chat'], ['A', 'a2', 'chat'], ['B', 'b1', 'chat'], ['A', undefined, 'forget'],
    ['A', 'a3', 'chat'], ['A', 'a3', 'chat'],
  ])
  assert.deepEqual(steps.map(({ preferences }) => Object.keys(preferences)), [
    ['order_filter'], ['order_filter'], [], [], [], ['salutation'],
  ])
  assert.deepEqual(steps[0].preferences, steps[1].preferences)
  assert.match(steps[1].answer, /A-102/)
  assert.match(steps[2].answer, /B-201.*\nB-202/)
  assert.doesNotMatch(steps[2].answer, /A-\d|按你的设置/)
  assert.match(steps[4].answer, /A-101.*\nA-102/)
  assert.match(steps[5].input.message, /\[手机号已遮盖\]/)
  assert.match(steps[5].answer, /\[手机号已遮盖\]/)
  assert.match(steps[5].preferences.salutation.value, /\[手机号已遮盖\]/)
})

test('watch bundle totals and alert traces match the source export', () => {
  const { source, summary, alerts } = watchBundle
  assert.deepEqual(source, { repo: 'agent-watch', commit: '567bec4' })
  assert.equal(summary.bad_lines, 2)
  const totals = groups => Object.fromEntries(Object.entries(groups).map(([name, row]) =>
    [name, [row.calls, row.timeouts, row.errors, row.tokens_in, row.tokens_out]]))
  // Values from the pinned source export, independent of how the site groups them.
  assert.deepEqual(totals(summary.by_user), {
    'user-1': [81, 5, 3, 950, 6014], 'user-2': [59, 1, 2, 709, 748], 'user-3': [60, 3, 1, 715, 805],
  })
  assert.deepEqual(totals(summary.by_model), {
    'model-a': [105, 7, 2, 1247, 6336], 'model-b': [95, 2, 4, 1127, 1231],
  })
  assert.deepEqual(alerts.map(({ type, request_ids }) => [type, request_ids]), [
    ['timeout_streak', ['r0001', 'r0002']], ['recovered', ['r0003']], ['budget_exceeded', ['r0003']],
    ['timeout_streak', ['r0079', 'r0080']], ['recovered', ['r0083']],
  ])
  assert.deepEqual(alerts.map(({ ts }) => Date.parse(ts)), alerts.map(({ ts }) => Date.parse(ts)).sort((a, b) => a - b))
  for (const alert of alerts) assert.deepEqual(alert.records.map(record => record.request_id), alert.request_ids)
})

test('watch filter returns exactly the events of the chosen type', () => {
  const { alerts } = watchBundle
  assert.deepEqual(filterAlerts(alerts), alerts)
  for (const type of ['timeout_streak', 'recovered', 'budget_exceeded']) {
    assert.deepEqual(filterAlerts(alerts, type), alerts.filter(alert => alert.type === type), type)
  }
  assert.deepEqual(filterAlerts(alerts, 'unknown'), [])
})

test('answer-check agreement totals and rates match the paired verdicts', () => {
  for (const [bot, { report, labels, agree }] of Object.entries(answerCheckBundle.bots)) {
    const labelVerdicts = new Map(labels.map(({ case_id, verdict }) => [case_id, verdict]))
    const pairs = report.cases.map(({ case_id, verdict }) => [verdict, labelVerdicts.get(case_id)])
    const bothFail = pairs.filter(([checker, label]) => checker === 'fail' && label === 'fail').length
    const checkerFailures = pairs.filter(([checker]) => checker === 'fail').length
    const labelFailures = pairs.filter(([, label]) => label === 'fail').length
    assert.deepEqual(agree.confusion, {
      both_fail: bothFail,
      checker_only_fail: checkerFailures - bothFail,
      labels_only_fail: labelFailures - bothFail,
      both_pass: pairs.filter(([checker, label]) => checker === 'pass' && label === 'pass').length,
    }, `${bot} agreement counts`)
    const rate = failures => failures === 0 ? null : Number((bothFail / failures).toFixed(3))
    assert.equal(agree.precision, rate(checkerFailures), `${bot} precision`)
    assert.equal(agree.recall, rate(labelFailures), `${bot} recall`)
  }
})

test('answer-check bundle totals match both saved report summaries', () => {
  const { cases, bots } = answerCheckBundle
  assert.deepEqual(answerCheckBundle.source, { repo: 'support-answer-check', commit: 'd2c90be' })
  const caseIds = cases.map(item => item.id).sort()
  assert.equal(caseIds.length, 40)
  assert.equal(new Set(caseIds).size, caseIds.length)
  assert.deepEqual(Object.keys(bots).sort(), ['careful', 'naive'])

  for (const [bot, { answers, report, labels }] of Object.entries(bots)) {
    for (const rows of [answers, report.cases, labels]) {
      assert.deepEqual(rows.map(row => row.case_id).sort(), caseIds, bot)
    }
    assert.equal(report.summary.total, cases.length, bot)
    const passes = report.cases.filter(row => row.verdict === 'pass').length
    const failures = report.cases.filter(row => row.verdict === 'fail').length
    assert.equal(report.summary.pass, passes, bot)
    assert.equal(report.summary.fail, failures, bot)
    assert.equal(passes + failures, report.summary.total, bot)
    assert.deepEqual(Object.keys(report.summary.by_reason).sort(), Object.keys(LABEL_NAMES).sort(), bot)
    const reasonCodes = report.cases.flatMap(row => row.reasons.map(reason => reason.label))
    for (const [code, count] of Object.entries(report.summary.by_reason)) {
      assert.equal(reasonCodes.filter(reason => reason === code).length, count, `${bot}: ${code}`)
    }
  }

  assert.deepEqual(compareReports(bots.naive.report, bots.careful.report), { improved: 13, regressed: 0 })
})

test('answer-check model names all seven labels in Chinese', () => {
  assert.deepEqual(LABEL_NAMES, {
    WRONG_FACT: '事实不对',
    NO_CITATION: '没给出处',
    BAD_CITATION: '出处不支持',
    MISSED_HANDOFF: '该转人工没转',
    NEEDLESS_HANDOFF: '不该转人工却转了',
    OVERPROMISE: '乱承诺',
    PRIVACY_LEAK: '泄露隐私',
  })
})

test('answer-check disagreement filter returns exactly the cases with different reasons', () => {
  for (const [bot, { report, labels }] of Object.entries(answerCheckBundle.bots)) {
    const expected = report.cases.filter(row => {
      const checkerCodes = row.reasons.map(reason => reason.label).sort()
      const labelCodes = [...labels.find(label => label.case_id === row.case_id).reasons].sort()
      return checkerCodes.join(',') !== labelCodes.join(',')
    }).map(row => row.case_id)

    const filtered = filterCases(answerCheckBundle, { bot, disagreementsOnly: true })
    assert.deepEqual(filtered.map(item => item.id), expected, bot)
    assert.deepEqual(agreementView(answerCheckBundle, bot).reasonCases.map(item => item.id), expected, bot)
  }
})

function readDemoHtml(dir) {
  return parse(readFileSync(new URL('index.html', dir), 'utf8'), { parseMode: 'html' })
}

function assertDemoMarkup(html, title, repo, controlCount) {
  const headings = elements(html, node => node.tag === 'h1')
  assert.equal(headings.length, 1)
  assert.equal(text(headings[0]), title)
  const controls = elements(html, node => ['input', 'select', 'textarea', 'button'].includes(node.tag))
  assert.equal(controls.length, controlCount)
  const labels = elements(html, node => node.tag === 'label')
  for (const control of controls) {
    const id = attribute(control, 'id')
    assert.ok(id, 'Missing control ID')
    assert.equal(elements(html, node => attribute(node, 'id') === id).length, 1, id)
    assert.ok(labels.some(label => attribute(label, 'for') === id && text(label)), `Missing label: ${id}`)
  }
  const [count] = elements(html, node => attribute(node, 'id') === 'result-count')
  assert.equal(attribute(count, 'aria-live'), 'polite')
  assert.equal(attribute(count, 'aria-atomic'), 'true')
  const [footer] = elements(html, node => node.tag === 'footer')
  assert.ok(elements(footer, node => node.tag === 'a' &&
    attribute(node, 'href') === `https://github.com/xoqiu09/${repo}`).some(link => text(link)))
  assert.ok(elements(html, node => node.tag === 'a' && attribute(node, 'href') === '/').some(link => text(link)))
}

test('answer-check page has one h1 and accessible labels for all four filters', () => {
  assertDemoMarkup(readDemoHtml(answerCheckDir), '客服回答质检演示', 'support-answer-check', 4)
})

test('answer-check page credits the initial annotation, spot check and later relabeling', () => {
  const [section] = elements(readDemoHtml(answerCheckDir), node => attribute(node, 'aria-labelledby') === 'agreement-title')
  const [intro] = elements(section, node => node.tag === 'p')
  assert.match(text(intro), /初版.*一名.*AI 标注员.*Claude 抽查.*10 条/)
  assert.match(text(intro), /naive 的第 36、38 题更新后，由另一名 AI 标注员独立复标/)
})

test('memory and watch pages have one h1, named controls, live counts and links', () => {
  assertDemoMarkup(readDemoHtml(memoryDir), '客服记忆演示', 'support-memory', 0)
  assertDemoMarkup(readDemoHtml(watchDir), 'AI 调用监测演示', 'agent-watch', 1)
})

// Run the shipped app against its HTML without adding a browser dependency to test:home.
class DemoElement extends EventTarget {
  children = []
  attributes = new Map()

  constructor(tag, parent = null) {
    super()
    this.tag = tag
    this.parentElement = parent
  }

  append(...children) {
    for (const child of children) {
      if (child instanceof DemoElement) child.parentElement = this
      this.children.push(child)
    }
  }

  replaceChildren(...children) {
    this.children = []
    this.append(...children)
  }

  add(option) {
    this.append(option)
  }

  setAttribute(name, value) {
    this.attributes.set(name, value)
  }

  get textContent() {
    return this.children.map(child => child instanceof DemoElement ? child.textContent : child).join('')
  }

  set textContent(value) {
    this.replaceChildren(String(value))
  }
}

function demoDocument(html) {
  const ids = new Map()
  function mount(element, parent) {
    const node = new DemoElement(element.tag, parent)
    const id = attribute(element, 'id')
    if (id) ids.set(id, node)
    const hasAttribute = name => element.props.some(prop => prop.type === NodeTypes.ATTRIBUTE && prop.name === name)
    node.disabled = hasAttribute('disabled')
    node.hidden = hasAttribute('hidden')
    node.inert = hasAttribute('inert')
    node.ariaHidden = attribute(element, 'aria-hidden')
    node.tabIndex = Number(attribute(element, 'tabindex') ?? 0)
    node.checked = hasAttribute('checked')
    if (node.tag === 'option') node.value = attribute(element, 'value')
    if (node.tag === 'select') node.value = attribute(element.children.find(child => child.tag === 'option'), 'value')
    for (const child of element.children) {
      if (child.type === NodeTypes.ELEMENT) node.append(mount(child, node))
      if (child.type === NodeTypes.TEXT) node.append(child.content)
    }
    return node
  }
  for (const element of html.children.filter(child => child.type === NodeTypes.ELEMENT)) mount(element)
  return { getElementById: id => ids.get(id), createElement: tag => new DemoElement(tag) }
}

function demoAncestors(node) {
  const ancestors = []
  for (let current = node; current; current = current.parentElement) ancestors.push(current)
  return ancestors
}

function changeDemoFilter(control, property, value) {
  control[property] = value
  const event = new Event('change', { bubbles: true })
  Object.defineProperty(event, 'target', { value: control })
  for (const node of demoAncestors(control)) node.dispatchEvent(event)
}

function demoFacts(list) {
  assert.equal(list.tag, 'dl')
  return list.children.map(({ children: [name, value] }) => {
    assert.equal(name.tag, 'dt')
    assert.equal(value.tag, 'dd')
    return [name.textContent, value.textContent]
  })
}

async function mountDemo(t, dir, bundle) {
  const document = demoDocument(readDemoHtml(dir))
  class DemoOption extends DemoElement {
    constructor(name, value) {
      super('option')
      this.textContent = name
      this.value = value
    }
  }
  for (const [name, value] of Object.entries({ document, Node: DemoElement, Option: DemoOption })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name)
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous)
      else delete globalThis[name]
    })
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  }
  const fetch = t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => bundle }))

  await import(new URL('app.js', dir))
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(fetch.mock.calls.map(call => call.arguments[0].href), [
    new URL('data/bundle.json', dir).href,
  ])
  return document.getElementById
}

test('answer-check page renders report scores and responds to the disagreement control', async t => {
  const byId = await mountDemo(t, answerCheckDir, answerCheckBundle)
  const bot = byId('bot')
  const disagreements = byId('disagreements')
  const result = byId('result-count')
  const exposed = node => demoAncestors(node).every(element => !element.hidden && !element.inert && element.ariaHidden !== 'true')

  await t.test('the two result cards show the corresponding report pass counts', () => {
    const cards = byId('scores').children
    assert.equal(cards.length, 2)
    const scores = Object.fromEntries(cards.map(card => {
      const name = card.children.find(child => child.tag === 'h3').textContent
      const score = card.children.find(child => child.className === 'score')
      return [name, Number(score.children.find(child => child.tag === 'strong').textContent)]
    }))
    assert.deepEqual(scores, Object.fromEntries(Object.entries(answerCheckBundle.bots)
      .map(([name, { report }]) => [name, report.summary.pass])))
  })

  await t.test('all four filters are operable once loaded and the live count is exposed', () => {
    for (const id of ['bot', 'verdict', 'category', 'disagreements']) {
      const control = byId(id)
      assert.ok(exposed(control) && control.tabIndex >= 0 &&
        demoAncestors(control).every(element => !element.disabled), `${id} must be usable after loading`)
    }
    assert.ok(exposed(result), 'The live result count must be exposed to assistive technology')
  })

  await t.test('the agreement note explains the citation disagreement for c26', () => {
    const [verdicts, reasons, cases] = byId('agreement-note').children
    assert.match(verdicts.textContent, /80 个回答中有 80 个的通过判定一致/)
    assert.match(reasons.textContent, /naive 有 1 道题的判定理由有分歧/)
    assert.equal(cases.children.length, 1)
    assert.match(cases.children[0].textContent,
      /^c26，.*双方都判这道题不通过。只有质检额外判了引用有误，因为引用写的是“商品须未安装”，没有逐字包含用例指定的证据句。$/s)
  })

  await t.test('checking and unchecking changes the listed cases and live count for each bot', () => {
    const allIds = answerCheckBundle.cases.map(({ id }) => id)
    function assertCases(botName, ids) {
      const listed = byId('cases').children.filter(node => node.tag === 'details')
      assert.equal(listed.length, ids.length, botName)
      assert.deepEqual(listed.map(node => node.children.find(child => child.tag === 'summary').textContent.split('，', 1)[0]), ids)
      const count = `${botName}：找到 ${ids.length} 道题。`
      assert.equal(result.textContent, ids.length ? count : `${count}没有符合筛选条件的题目。`)
    }

    assertCases('naive', allIds)
    changeDemoFilter(disagreements, 'checked', true)
    assertCases('naive', ['c26'])
    changeDemoFilter(disagreements, 'checked', false)
    assertCases('naive', allIds)

    changeDemoFilter(bot, 'value', 'careful')
    assertCases('careful', allIds)
    changeDemoFilter(disagreements, 'checked', true)
    assertCases('careful', [])
    changeDemoFilter(disagreements, 'checked', false)
    assertCases('careful', allIds)
  })
})

test('memory renders every step, including account B and the masked phone', async t => {
  const byId = await mountDemo(t, memoryDir, memoryBundle)
  assert.equal(byId('result-count').textContent, '共 6 步。')
  assert.deepEqual(byId('steps').children.map(step => step.children[0].textContent.split('，', 1)[0]), [
    '第 1 步', '第 2 步', '第 3 步', '第 4 步', '第 5 步', '第 6 步',
  ])
  const steps = byId('steps').children
  assert.ok(steps.every(step => step.tag === 'details' && step.children[0].tag === 'summary'))
  const orderPreference = [['订单筛选', '只看未发货订单。写入时间 2026-01-01T00:00:00Z']]
  const expectedPreferences = [
    orderPreference, orderPreference, '账户 B 没有已保存的偏好。',
    '账户 A 没有已保存的偏好。', '账户 A 没有已保存的偏好。',
    [['称呼', '王先生[手机号已遮盖]。写入时间 2026-01-01T00:00:05Z']],
  ]
  for (const [index, step] of steps.entries()) {
    const { input, answer } = memoryBundle.steps[index]
    const [summary, body] = step.children
    const who = input.command === 'chat'
      ? `账户 ${input.account} 在会话 ${input.session} 说：“${input.message}”`
      : '账户 A 执行清除全部偏好的命令（独立于会话）'
    assert.equal(summary.textContent, `第 ${index + 1} 步，${who}`)
    const [replyTitle, reply, preferenceTitle, preferences] = body.children
    assert.equal(replyTitle.textContent, input.command === 'chat' ? '客服回复' : '命令结果')
    assert.equal(reply.textContent, answer, `第 ${index + 1} 步的回复`)
    assert.equal(preferenceTitle.textContent, '这一步之后保存的偏好')
    const expected = expectedPreferences[index]
    if (typeof expected === 'string') {
      assert.equal(preferences.tag, 'p')
      assert.equal(preferences.textContent, expected)
    } else {
      assert.deepEqual(demoFacts(preferences), expected, `第 ${index + 1} 步的偏好`)
    }
  }
  assert.equal(steps[5].textContent.match(/\[手机号已遮盖\]/g).length, 3)
})

test('watch renders scoped tables and keeps the live alert list in sync with the control', async t => {
  const byId = await mountDemo(t, watchDir, watchBundle)
  assert.match(byId('overview-status').textContent, /200 次有效调用.*2 行/)

  const { summary, alerts } = watchBundle
  const optionLabels = { '': '全部类型', timeout_streak: '连续超时', recovered: '恢复', budget_exceeded: '用量超额' }
  const statusLabels = { ok: '成功', timeout: '超时', error: '错误' }

  await t.test('both summary tables provide the correct headers and values under each heading', () => {
    const tables = byId('overview').children
    assert.deepEqual(tables.map(table => table.children[0].textContent), ['按用户汇总', '按模型汇总'])
    const metrics = {
      '调用数': 'calls', '成功率': 'success_rate', '超时数': 'timeouts', '错误数': 'errors',
      '延迟 p50（毫秒）': 'p50_ms', '延迟 p95（毫秒）': 'p95_ms', '输入 token': 'tokens_in', '输出 token': 'tokens_out',
    }
    for (const [index, groups] of [summary.by_user, summary.by_model].entries()) {
      const table = tables[index]
      assert.equal(table.tag, 'table')
      const [caption, thead, tbody] = table.children
      assert.deepEqual([caption.tag, thead.tag, tbody.tag], ['caption', 'thead', 'tbody'])
      const colHeaders = thead.children[0].children
      assert.deepEqual(colHeaders.map(cell => cell.textContent), ['指标', ...Object.keys(groups)], caption.textContent)
      assert.ok(colHeaders.every(cell => cell.tag === 'th' && cell.attributes.get('scope') === 'col'))
      assert.deepEqual(tbody.children.map(row => row.children[0].textContent), Object.keys(metrics), caption.textContent)
      for (const { children: [header, ...cells] } of tbody.children) {
        const metric = metrics[header.textContent]
        assert.equal(header.tag, 'th')
        assert.equal(header.attributes.get('scope'), 'row')
        assert.equal(cells.length, colHeaders.length - 1)
        for (const [column, cell] of cells.entries()) {
          const group = colHeaders[column + 1].textContent
          const value = groups[group][metric]
          const expected = metric === 'success_rate' ? `${Math.round(value * 1000) / 10}%` : String(value)
          assert.equal(cell.tag, 'td')
          assert.equal(cell.textContent, expected, `${caption.textContent} / ${group} / ${header.textContent}`)
        }
      }
    }
  })

  function assertAlerts(expected) {
    const details = byId('alerts').children
    assert.deepEqual(details.map(({ tag, children: [heading] }) => [tag, heading.tag, heading.textContent]),
      expected.map(alert => ['details', 'summary', `${optionLabels[alert.type]}，${alert.model ?? alert.user}，${alert.ts}`]))
    assert.equal(byId('result-count').textContent, `找到 ${expected.length} 条事件。`)
  }

  await t.test('each alert shows the fields for each referenced request', () => {
    assertAlerts(alerts)
    for (const [index, { request_ids: ids, records }] of alerts.entries()) {
      const detail = byId('alerts').children[index]
      const trace = detail.children[1].children.find(node => node.tag === 'ul')
      assert.deepEqual(trace.children.map(item => item.children[0].textContent), ids.map(id => `请求编号 ${id}`))
      for (const [position, id] of ids.entries()) {
        const record = records.find(item => item.request_id === id)
        const item = trace.children[position]
        assert.equal(item.tag, 'li')
        assert.ok(item.children[1], `请求 ${id} 缺少调用明细`)
        assert.deepEqual(demoFacts(item.children[1]), [
          ['时间', record.ts], ['用户', record.user], ['模型', record.model], ['状态', statusLabels[record.status]],
          ['延迟（毫秒）', String(record.latency_ms)], ['输入 token', String(record.tokens_in)], ['输出 token', String(record.tokens_out)],
        ], `请求 ${id} 的调用明细`)
      }
    }
  })

  await t.test('selecting each displayed option changes the alert events and live count', () => {
    const control = byId('alert-type')
    assert.ok(demoAncestors(control).every(node => !node.hidden && !node.disabled))
    const options = control.children.filter(node => node.tag === 'option')
    assert.deepEqual(options.map(option => [option.value, option.textContent]), Object.entries(optionLabels))
    for (const option of options) {
      changeDemoFilter(control, 'value', option.value)
      assertAlerts(alerts.filter(alert => option.value === '' || alert.type === option.value))
    }
  })
})

test('QAI featured card identifies team ownership, responsibility and delivery', () => {
  const card = featuredCard('qai')
  assert.equal(text(elements(card, withClass('kind'))[0]), '团队业务 · 本人参与')
  assert.equal(text(featuredTitleButton(card), true), 'QAI · 团队内部模型中转站')
  assert.ok(text(card).includes('负责功能实现'))
  assert.equal(text(elements(card, withClass('card-status'))[0]), '两周交付 · 团队内部在用')
})

test('QAI detail identifies team ownership, responsibility and delivery', () => {
  const detail = parse(notes.qai, { parseMode: 'html' })
  assert.equal(text(elements(detail, withClass('eyebrow'))[0]), '团队内部工具')
  assert.equal(text(elements(detail, node => node.tag === 'h2')[0]), 'QAI · 团队内部模型中转站')
  const facts = elements(detail, node => node.tag === 'dd').map(node => text(node))
  assert.ok(facts.includes('内部工具 · 负责功能实现'))
  assert.ok(facts.includes('两周交付 · 团队内部在用'))
})

function hasPrivatePhonePrefix(source) {
  return source.includes('176')
}

test('resume sources omit the private phone prefix', () => {
  for (const entry of readdirSync(resumeDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const source = readFileSync(join(entry.parentPath, entry.name))
    assert.ok(!hasPrivatePhonePrefix(source), entry.name)
  }
})

test('resume privacy check detects a synthetic occurrence of the private phone prefix', () => {
  assert.equal(hasPrivatePhonePrefix(Buffer.from('tel:176-SYNTHETIC')), true)
  assert.equal(hasPrivatePhonePrefix(Buffer.from('tel:TEST-ONLY')), false)
})

test('public demo and other public text omit private machine details', () => {
  assertPublicPrivacy(readFiles(publicDir))
})

test('public privacy check rejects synthetic machine details in a fixture', () => {
  const fixture = new Map([
    ['mini-exchange-demo/data/example.json', JSON.stringify({ path: '/Volumes/SyntheticDisk/tools/go' })],
    ['mini-exchange-demo/example.js', 'http://synthetic-machine.local:1234'],
    ['data/example-ip.json', '192.0.2.12'],
    ['data/example-ipv6.json', '[2001:db8::42]'],
    ['data/example-note.json', 'Owner 2000-01-01 授权'],
  ])
  assert.throws(() => assertPublicPrivacy(fixture), error => {
    assert.match(error.message, /mini-exchange-demo\/data\/example\.json: local absolute path/)
    assert.match(error.message, /mini-exchange-demo\/example\.js: local hostname/)
    assert.match(error.message, /data\/example-ip\.json: IP address/)
    assert.match(error.message, /data\/example-ipv6\.json: IP address/)
    assert.match(error.message, /data\/example-note\.json: one-off authorization note/)
    return true
  })
})

test('public privacy check rejects an undated prior approval note on its own', () => {
  const fixture = new Map([['example.txt', '需要 Owner 先批准引入依赖']])
  assert.throws(() => assertPublicPrivacy(fixture), /example\.txt: one-off authorization note/)
})

test('public privacy check rejects a local tool path on its own', () => {
  const fixture = new Map([['example.txt', '/usr/local/go/bin/go']])
  assert.throws(() => assertPublicPrivacy(fixture), /example\.txt: local absolute path/)
})

test('knowledge map remains a private project with only a fictional public illustration', () => {
  const map = records.find(project => project.id === 'wildheart')
  assert.equal(map.title, '知识地图')
  assert.equal(map.visibility, 'private')
  assert.equal(map.openSource, false)
  assert.match(notes.wildheart, /虚构/)
  assert.match(notes.wildheart, /私有项目/)
  assert.doesNotMatch(notes.wildheart, /<a\b|download|kuangye-heart|localhost|file:\/\//i)
  for (const html of Object.values(notes)) assert.doesNotMatch(html, /<script\b|\son\w+\s*=|javascript:|file:\/\/|\/Volumes\/|\/Users\//i)
})
