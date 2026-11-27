import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { isUtf8 } from 'node:buffer'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { isIP } from 'node:net'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'
import { parse, NodeTypes } from '@vue/compiler-dom'
import { renderToString } from '@vue/server-renderer'
import vue from '@vitejs/plugin-vue'
import { createServer } from 'vite'
import { createRenderer, createSSRApp, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { agreementView, compareReports, filterCases, LABEL_NAMES } from '../public/answer-check-demo/model.js'
import { filterAlerts } from '../public/watch-demo/model.js'
import { escapeHtml } from '../shared/site.ts'
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
const actionsDir = new URL('actions-demo/', publicDir)
const retrievalDir = new URL('retrieval-demo/', publicDir)
const readBundle = dir => JSON.parse(readFileSync(new URL('data/bundle.json', dir), 'utf8'))
const answerCheckBundle = readBundle(answerCheckDir)
const memoryBundle = readBundle(memoryDir)
const watchBundle = readBundle(watchDir)
const actionsBundle = readBundle(actionsDir)
const retrievalBundle = readBundle(retrievalDir)
let page
let notes
let router
let onDialogKey
let server
let ResumePage

before(async () => {
  // Evaluate Vue's client render function in Node so tests can activate its real controls.
  const vuePlugin = vue({ template: { compilerOptions: { hoistStatic: false } } })
  const transform = vuePlugin.transform
  vuePlugin.transform = function (source, id, options) {
    return transform.call(this, source, id, { ...options, ssr: false })
  }
  server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    configFile: false,
    plugins: [vuePlugin],
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
  })
  const pageModule = await server.ssrLoadModule('/src/features/resume/pages/ResumePage.vue')
  ResumePage = pageModule.default
  const { useResume } = await server.ssrLoadModule('/src/features/resume/useResume.ts')
  router = createResumeRouter()
  const app = createSSRApp({
    setup() {
      onDialogKey = useResume().onDialogKey
      return () => h(ResumePage)
    },
  }).use(router)
  await router.push('/')
  page = parse(await renderToString(app), { parseMode: 'html' })

  const { loadProjectNotes } = await server.ssrLoadModule('/src/features/resume/data.ts')
  notes = await loadProjectNotes()
})

after(async () => { await server?.close() })

function createResumeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: ResumePage, alias: ['/intel', '/radar', '/articles'] }],
  })
}

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
  const ids = records.map(project => project.id)
  assert.equal(records.length, 34)
  assert.equal(new Set(ids).size, 34)
  assert.deepEqual(Object.keys(notes).sort(), [...ids].sort())
  assert.deepEqual(records.filter(project => project.kind === 'team').map(project => project.id).sort(), ['qai', 'saas', 'theai'])

  const catalog = section('catalog')
  const cards = elements(catalog, withClass('catalog-card'))
  assert.deepEqual(cards.map(card => attribute(elements(card, node => node.tag === 'button')[0], 'data-open')), ids)
  const [heading] = elements(catalog, node => node.tag === 'h2')
  assert.equal(text(elements(heading, node => node.tag === 'sup')[0]), '34')
  const filters = elements(catalog, node => attribute(node, 'data-category-filter') !== undefined)
  for (const filter of filters) {
    const category = attribute(filter, 'data-category-filter')
    const [count] = elements(filter, node => node.tag === 'span')
    assert.equal(text(count), String(filterResumeProjects(records, category, true, '').length))
  }
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
      ['/retrieval-demo/index.html', '知识库检索评测演示个人项目'],
    ] },
    { title: '2出了问题查得出', opens: ['miniexchange'], links: [['/actions-demo/index.html', '客服办事演示个人项目']] },
    { title: '3用量管得住', opens: ['qai'], links: [['/watch-demo/index.html', 'AI 调用监测演示个人项目']] },
    { title: '4进展看得见', opens: ['steward', 'xiaomao'], links: [] },
  ])
  for (const facet of facets) {
    for (const [href] of facet.links) {
      assert.ok(statSync(new URL(`.${href}`, publicDir), { throwIfNoEntry: false })?.isFile(), `missing ${href}`)
    }
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

// Vue supplies the elements, event handlers and updates. The host models only the DOM APIs they use.
class ResumeElement extends EventTarget {
  children = []
  props = {}
  dataset = {}
  open = false

  constructor(tag) {
    super()
    this.tag = tag
    this.tagName = tag.toUpperCase()
  }

  setAttribute(key, value) { this.props[key] = value }
  removeAttribute(key) { delete this.props[key] }
  focus() {}
  querySelectorAll() { return [] }
  showModal() { this.open = true }
  close() { this.open = false }
}

function removeRenderedNode(node) {
  const parent = node.parent
  if (parent) parent.children.splice(parent.children.indexOf(node), 1)
  node.parent = null
}

const resumeRenderer = createRenderer({
  createElement: tag => new ResumeElement(tag),
  createText: value => ({ value }),
  createComment: () => ({ value: '' }),
  setText: (node, value) => { node.value = value },
  setElementText: (node, value) => { node.children = []; node.value = value },
  patchProp(node, key, previous, value) {
    node.props[key] = value
    if (key === 'onClick') {
      if (previous) node.removeEventListener('click', previous)
      if (value) node.addEventListener('click', value)
    }
  },
  insert(node, parent, anchor) {
    removeRenderedNode(node)
    node.parent = parent
    parent.children.splice(anchor ? parent.children.indexOf(anchor) : parent.children.length, 0, node)
  },
  remove: removeRenderedNode,
  parentNode: node => node.parent,
  nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
})

function findRendered(node, matches) {
  if (matches(node)) return node
  for (const child of node.children ?? []) {
    const match = findRendered(child, matches)
    if (match) return match
  }
}

function renderedMarkup(node) {
  if (!node.tag) return escapeHtml(node.value)
  const attrs = Object.entries(node.props)
    .filter(([key, value]) => key !== 'innerHTML' && ['string', 'number', 'boolean'].includes(typeof value))
    .map(([key, value]) => ` ${key}="${escapeHtml(String(value))}"`).join('')
  const content = node.props.innerHTML ?? (node.children.length
    ? node.children.map(renderedMarkup).join('')
    : escapeHtml(node.value ?? ''))
  return `<${node.tag}${attrs}>${content}</${node.tag}>`
}

async function openCatalogDialog(t, id) {
  const clientRouter = createResumeRouter()
  await clientRouter.push('/')
  const app = resumeRenderer.createApp(ResumePage).use(clientRouter)
  const root = new ResumeElement('div')
  const document = {
    body: new ResumeElement('body'),
    documentElement: new ResumeElement('html'),
    head: { querySelector: () => null, appendChild() {} },
    createElement: tag => new ResumeElement(tag),
  }
  const window = new EventTarget()
  window.matchMedia = () => Object.assign(new EventTarget(), { matches: false })
  const globals = { document, window, HTMLElement: ResumeElement }
  const previous = Object.getOwnPropertyDescriptors(globalThis)
  t.after(() => {
    try { app.unmount() } finally {
      for (const name of Object.keys(globals)) {
        if (previous[name]) Object.defineProperty(globalThis, name, previous[name])
        else delete globalThis[name]
      }
    }
  })
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  }
  app.mount(root)

  const catalog = findRendered(root, node => node.props?.id === 'catalog')
  assert.ok(catalog, 'Missing project catalog')
  const button = findRendered(catalog, node => node.tag === 'button' && node.props['data-open'] === id)
  assert.ok(button, `Missing catalog button: ${id}`)
  const push = t.mock.method(clientRouter, 'push')
  button.dispatchEvent(new Event('click'))
  assert.equal(push.mock.callCount(), 1, `Catalog button did not navigate to ${id}`)
  await push.mock.calls[0].result
  await new Promise(resolve => setImmediate(resolve))

  assert.equal(clientRouter.currentRoute.value.hash, `#project/${id}`)
  const dialog = findRendered(root, node => node.tag === 'dialog' && node.props.id === 'project-dialog')
  assert.ok(dialog?.open, `Project dialog did not open: ${id}`)
  const body = findRendered(dialog, node => node.props?.id === 'dialog-body')
  assert.ok(body, `Missing project dialog body: ${id}`)
  return { html: renderedMarkup(body), titleId: dialog.props['aria-labelledby'] }
}

for (const [id, href] of [
  ['support-answer-check', '/answer-check-demo/index.html'],
  ['support-memory', '/memory-demo/index.html'],
  ['agent-watch', '/watch-demo/index.html'],
  ['support-actions', '/actions-demo/index.html'],
  ['kb-retrieval-eval', '/retrieval-demo/index.html'],
]) {
  test(`personal project dialog links to the bundled demo and public repository: ${id}`, async t => {
    const project = records.find(record => record.id === id)
    assert.ok(project, `Missing catalog entry: ${id}`)
    assert.equal(project.kind, 'personal')
    assert.equal(project.category, 'product')
    assert.equal(project.visibility, 'public')
    assert.equal(project.history, false)
    assert.equal(projectIdFromHash(`#project/${id}`, records), id)

    const { html, titleId } = await openCatalogDialog(t, id)
    const detail = parse(html, { parseMode: 'html' })
    assert.ok(titleId, `Dialog has no accessible title reference: ${id}`)
    const [title] = elements(detail, node => node.tag === 'h2' && attribute(node, 'id') === titleId)
    assert.equal(text(title), project.title, `Opened project dialog title: ${id}`)
    const intros = elements(detail, withClass('dialog-intro'))
    assert.equal(intros.length, 1)
    assert.ok(text(intros[0], true), `Missing project introduction: ${id}`)
    assert.equal(elements(detail, node => node.tag === 'dt').length, 3)
    assert.equal(elements(detail, node => node.tag === 'dd').length, 3)
    assert.equal(elements(detail, node => node.tag === 'h3').length, 2)

    const links = elements(detail, node => node.tag === 'a')
    assert.equal(links.length, 2)
    const [demo, repository] = links
    assert.equal(attribute(demo, 'href'), href, `Demo link for ${id} must open ${href}`)
    assert.ok(statSync(new URL(`.${attribute(demo, 'href')}`, publicDir), { throwIfNoEntry: false })?.isFile(), `Missing demo file: ${href}`)
    assert.equal(attribute(repository, 'href'), `https://github.com/xoqiu09/${id}`)
    assert.ok(links.every(link => text(link, true).length && attribute(link, 'tabindex') === undefined))
    assertPublicPrivacy(new Map([
      [`records.json: ${id}`, JSON.stringify(project)],
      [`rendered dialog: ${id}`, html],
    ]))
  })
}

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

test('answer-check and retrieval demos pass the public-file privacy checks', () => {
  assertPublicPrivacy(readFiles(answerCheckDir))
  assertPublicPrivacy(readFiles(retrievalDir))
})

test('memory and watch demos pass the public-file privacy checks', () => {
  assertPublicPrivacy(readFiles(memoryDir))
  assertPublicPrivacy(readFiles(watchDir))
})

test('actions demo passes the public-file privacy checks and masks street numbers', () => {
  const files = readFiles(actionsDir)
  assertPublicPrivacy(files)
  for (const [path, value] of files) {
    if (value === null) continue
    assert.doesNotMatch(value, /9287|9387|3186号|4186号|fixture-host\.example\.test|fixture-demo-user/, path)
  }
})

test('none of the support, watch and retrieval demo bundles contains a raw phone number', () => {
  const phone = /(?<![0-9０-９])(?:[+＋]?[8８][6６][ -]?)?[1１][3-9３-９](?:[ -]?[0-9０-９]){9}(?![0-9０-９])/u
  for (const dir of [answerCheckDir, memoryDir, watchDir, actionsDir, retrievalDir]) {
    // Use a boolean so a failure does not print the phone number or bundle.
    assert.equal(phone.test(readFileSync(new URL('data/bundle.json', dir), 'utf8')), false, dir.pathname)
  }
})

test('actions bundle is identical to the pinned supportactions demo export', () => {
  const { source, ...data } = actionsBundle
  assert.deepEqual(source, { repo: 'support-actions', commit: 'a62bebb' })
  // Digest of the parsed output of python3 -m supportactions demo --out … at that revision.
  assert.equal(createHash('sha256').update(JSON.stringify(data)).digest('hex'),
    'e1e28429ad04054dc3f6bae91668c42fbde8a4ea8d4de9ba16887ee0a5a0046d')
})

test('retrieval bundle is identical to the pinned kbeval export', () => {
  const { source, ...data } = retrievalBundle
  assert.deepEqual(source, { repo: 'kb-retrieval-eval', commit: '203fdfe' })
  // Digest of the parsed output of python3 -m kbeval export --out … at that revision.
  assert.equal(createHash('sha256').update(JSON.stringify(data)).digest('hex'),
    'e32253142d579b84e85cdeef268c51f5f5d0988cb3436655412f3b4a5bc1c2dc')
})

test('memory bundle matches the six-step source export and masks the sample phone', () => {
  const { source, steps } = memoryBundle
  assert.deepEqual(source, { repo: 'support-memory', commit: '84871a5' })
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

test('memory M2 bundle preserves the consent, window and audit results from the export', () => {
  const { consent, preferences, history, audit } = memoryBundle.m2
  assert.equal(consent.account, 'A')
  assert.equal(consent.enabled, false)
  assert.deepEqual(preferences, {})
  assert.equal(history.turns.length, 6)
  assert.equal(history.summary.length, 1)
  assert.match(history.summary[0].user, /\[手机号已遮盖\]/)
  assert.deepEqual(history.summary[0].preferences, { order_filter: 'unshipped' })
  assert.deepEqual(audit.map(({ action }) => action), ['write', ...Array(7).fill('read'), 'delete'])
  for (const entry of audit) assert.deepEqual(Object.keys(entry).sort(), ['account', 'action', 'key', 'session', 'time'])
})

test('watch bundle totals and alert traces match the source export', () => {
  const { source, summary, alerts, report } = watchBundle
  assert.deepEqual(source, { repo: 'agent-watch', commit: '4385fd8' })
  assert.equal(summary.bad_lines, 2)
  const totals = groups => Object.fromEntries(Object.entries(groups).map(([name, row]) =>
    [name, [row.calls, row.timeouts, row.errors, row.tokens_in, row.tokens_out]]))
  // Values from the pinned source export, independent of how the site groups them.
  assert.deepEqual(totals(summary.by_user), {
    'user-1': [86, 7, 4, 1000, 26034], 'user-2': [59, 1, 2, 709, 748], 'user-3': [60, 3, 1, 715, 805],
  })
  assert.deepEqual(totals(summary.by_model), {
    'model-a': [110, 9, 3, 1297, 26356], 'model-b': [95, 2, 4, 1127, 1231],
  })
  const costs = groups => Object.fromEntries(Object.entries(groups).map(([name, row]) => [name, row.cost]))
  assert.deepEqual(costs(summary.by_user), { 'user-1': 106.6268, 'user-2': 4.8868, 'user-3': 5.1718 })
  assert.deepEqual(costs(summary.by_model), { 'model-a': 107.0453, 'model-b': 9.64 })
  assert.deepEqual(report, {
    date: '2026-11-28',
    metrics: { calls: 5, p95_ms: 2600, success_rate: 0.4, cost: 80.1425, tokens_in: 50, tokens_out: 20020, unpriced_model_count: 0 },
    comparison: {
      flags: ['变慢', '失败变多', '费用上涨'], message: null, previous_date: '2026-11-27',
      previous: { calls: 200, p95_ms: 1687, success_rate: 0.925, cost: 36.5428, tokens_in: 2374, tokens_out: 7567, unpriced_model_count: 0 },
    },
  })
  assert.deepEqual(alerts.map(({ type, request_ids }) => [type, request_ids]), [
    ['timeout_streak', ['r0001', 'r0002']], ['recovered', ['r0003']], ['budget_exceeded', ['r0003']],
    ['timeout_streak', ['r0079', 'r0080']], ['recovered', ['r0083']],
    ['timeout_streak', ['r0201', 'r0202']], ['recovered', ['r0203']], ['budget_exceeded', ['r0203']],
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
  const html = readDemoHtml(answerCheckDir)
  assertDemoMarkup(html, '客服回答质检演示', 'support-answer-check', 4)
  const [link] = elements(html, node => node.tag === 'a' &&
    attribute(node, 'href') === 'https://github.com/xoqiu09/support-answer-check/blob/main/docs/PRD.md')
  assert.equal(text(link), '《客服质检后台产品需求》')
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

test('actions page has one h1, live counts, named links and source evidence for human rejection', () => {
  const html = readDemoHtml(actionsDir)
  assertDemoMarkup(html, '客服办事演示', 'support-actions', 0)
  const [section] = elements(html, node => attribute(node, 'aria-labelledby') === 'verification-title')
  assert.ok(elements(section, node => node.tag === 'li').some(node =>
    text(node) === '源码测试模拟人工拒绝退款，核对退款笔数为 0，后续改地址和另一笔退款都未执行。'))
})

test('retrieval page has one h1, a named reason control, a live count and named links', () => {
  assertDemoMarkup(readDemoHtml(retrievalDir), '知识库检索评测演示', 'kb-retrieval-eval', 1)
})

test('memory labels the account B isolation claim as a source test', () => {
  const [section] = elements(readDemoHtml(memoryDir), node => attribute(node, 'aria-labelledby') === 'verification-title')
  const claim = elements(section, node => node.tag === 'li').map(node => text(node))
    .find(line => line.includes('账户 B 的设置和写入时间照旧'))
  assert.equal(claim, '源码测试另行验证了账户隔离。清除账户 A 的一项或全部偏好后，账户 B 的设置和写入时间照旧。')
})

test('memory and watch M2 headings name their sections', () => {
  for (const [dir, expected] of [
    [memoryDir, ['同意开关', '对话窗口和摘要', '读写记录']],
    [watchDir, ['费用', '日报']],
  ]) {
    const sections = elements(readDemoHtml(dir), node => node.tag === 'section')
    const names = sections.map(section => {
      const [heading] = elements(section, node => node.tag === 'h2' &&
        attribute(node, 'id') === attribute(section, 'aria-labelledby'))
      assert.ok(heading)
      return text(heading)
    })
    assert.deepEqual(names.filter(name => expected.includes(name)), expected)
  }
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

  get tabIndex() {
    return Number(this.attributes.get('tabindex') ?? 0)
  }

  set tabIndex(value) {
    this.setAttribute('tabindex', String(value))
  }

  focus() {
    demoAncestors(this).at(-1).activeElement = this
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
    for (const prop of element.props) {
      if (prop.type === NodeTypes.ATTRIBUTE) node.setAttribute(prop.name, prop.value?.content ?? '')
    }
    const id = attribute(element, 'id')
    if (id) ids.set(id, node)
    const hasAttribute = name => node.attributes.has(name)
    node.disabled = hasAttribute('disabled')
    node.hidden = hasAttribute('hidden')
    node.inert = hasAttribute('inert')
    node.ariaHidden = attribute(element, 'aria-hidden')
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

function demoExposedText(node) {
  if (!node || demoAncestors(node).some(parent => parent.hidden || parent.inert ||
      parent.ariaHidden === 'true' || parent.attributes.get('aria-hidden') === 'true')) return ''
  return node.children.map(child => child instanceof DemoElement ? demoExposedText(child) : child).join('')
}

function changeDemoFilter(control, property, value) {
  control[property] = value
  const event = new Event('change', { bubbles: true })
  Object.defineProperty(event, 'target', { value: control })
  for (const node of demoAncestors(control)) node.dispatchEvent(event)
}

function visibleDemoElements(node) {
  if (!(node instanceof DemoElement) || node.hidden || node.inert) return []
  const children = node.tag === 'details' && !(node.open ?? node.attributes.has('open'))
    ? [node.children.find(child => child.tag === 'summary')]
    : node.children
  return [node, ...children.flatMap(visibleDemoElements)]
}

// Model the native key actions these demos use in the dependency-free DOM fixture.
function pressDemoKey(root, key) {
  const focused = root.activeElement
  if (key === 'Tab') {
    const stops = visibleDemoElements(root).filter(node =>
      node.tabIndex >= 0 && !demoAncestors(node).some(parent => parent.disabled) &&
      (node.attributes.has('tabindex') || ['button', 'input', 'select', 'summary', 'textarea'].includes(node.tag) ||
        (node.tag === 'a' && node.attributes.has('href'))))
    const tabOrder = node => node.tabIndex || Number.MAX_SAFE_INTEGER
    stops.sort((a, b) => tabOrder(a) - tabOrder(b))
    stops[stops.indexOf(focused) + 1]?.focus()
  } else if (key === 'ArrowDown' && focused.tag === 'select') {
    const options = focused.children.filter(child => child.tag === 'option')
    const next = options[options.findIndex(option => option.value === focused.value) + 1]
    assert.ok(next, 'Expected another filter option')
    changeDemoFilter(focused, 'value', next.value)
  } else {
    assert.equal(key, 'Enter')
    assert.equal(focused.tag, 'summary')
    const details = focused.parentElement
    details.open = !(details.open ?? details.attributes.has('open'))
    const group = details.name ?? details.attributes.get('name')
    if (details.open && group) {
      for (const peer of details.parentElement.children) {
        if (peer !== details && peer.tag === 'details' &&
            (peer.name ?? peer.attributes.get('name')) === group) peer.open = false
      }
    }
  }
}

function demoFacts(list, readText = node => node.textContent) {
  assert.equal(list.tag, 'dl')
  return list.children.map(({ children: [name, value] }) => {
    assert.equal(name.tag, 'dt')
    assert.equal(value.tag, 'dd')
    return [readText(name), readText(value)]
  })
}

async function mountDemo(t, dir, bundle, { ok = true, onLoading } = {}) {
  const html = readDemoHtml(dir)
  const entries = elements(html, node => node.tag === 'script' && attribute(node, 'type') === 'module')
  assert.equal(entries.length, 1, 'Expected one module entry in index.html')
  const src = attribute(entries[0], 'src')?.trim()
  assert.ok(src, 'Missing module entry src in index.html')
  const index = new URL(`${relative(fileURLToPath(publicDir), fileURLToPath(dir))}/index.html`, 'https://demo.test')
  const entry = new URL(src, index)
  assert.equal(entry.origin, index.origin, 'Expected a local module entry')
  const app = new URL(`.${entry.pathname}${entry.search}${entry.hash}`, publicDir)
  const document = demoDocument(html)
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
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    onLoading?.(document.getElementById)
    return { ok, status: ok ? 200 : 503, json: async () => bundle }
  })

  app.searchParams.set('test', t.name)
  await import(app)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(fetch.mock.calls.map(call => call.arguments[0].href), [
    new URL('data/bundle.json', dir).href,
  ])
  return document.getElementById
}

test('retrieval renders all matrix values with named tables and scoped headers', async t => {
  const byId = await mountDemo(t, retrievalDir, retrievalBundle)
  const tables = byId('matrix').children
  assert.equal(tables.length, 3)
  const methods = [
    ['heading/bm25', '按标题切块 · BM25'],
    ['heading/bigram', '按标题切块 · 相邻两字匹配'],
    ['fixed-200-0/bm25', '每 200 字切块，无重叠 · BM25'],
    ['fixed-200-0/bigram', '每 200 字切块，无重叠 · 相邻两字匹配'],
    ['fixed-200-50/bm25', '每 200 字切块，重叠 50 字 · BM25'],
    ['fixed-200-50/bigram', '每 200 字切块，重叠 50 字 · 相邻两字匹配'],
  ]
  for (const [index, cutoff] of [1, 3, 5].entries()) {
    const table = tables[index]
    assert.equal(table.tag, 'table')
    const [caption, head, body] = table.children
    assert.equal(caption.tag, 'caption')
    assert.equal(caption.textContent, `查看前 ${cutoff} 个片段的评测结果`)
    assert.deepEqual(head.children[0].children.map(cell => [cell.tag, cell.attributes.get('scope'), cell.textContent]),
      ['切块与检索方式', `Recall@${cutoff}`, 'MRR'].map(name => ['th', 'col', name]))
    assert.equal(body.children.length, methods.length)
    for (const [row, [method, name]] of methods.entries()) {
      const { recall, mrr } = retrievalBundle.configs[`${method}/${cutoff}`]
      const [header, ...values] = body.children[row].children
      assert.equal(header.tag, 'th')
      assert.equal(header.attributes.get('scope'), 'row')
      assert.equal(header.textContent, name)
      assert.ok(values.every(cell => cell.tag === 'td'))
      assert.deepEqual(values.map(cell => cell.textContent), [recall.toFixed(4), mrr.toFixed(5)])
    }
  }
  assert.equal(demoExposedText(byId('recommended-setting')), '按标题切块 · 相邻两字匹配，查看前 3 个片段。')
  assert.equal(demoExposedText(byId('recommendation-reason')), retrievalBundle.recommendation.reason)
})

test('retrieval failure filter renders exactly the questions with each chosen reason', async t => {
  const byId = await mountDemo(t, retrievalDir, retrievalBundle)
  const results = byId('failures')
  const control = byId('failure-reason')
  const expected = new Map([
    ['', ['Q03', 'Q05', 'Q06', 'Q07', 'Q10', 'Q26', 'Q34', 'Q39']],
    ['被相似段落挤掉', ['Q03', 'Q05', 'Q39']],
    ['答案被切断', ['Q06', 'Q07', 'Q10', 'Q26']],
    ['关键词不重合', ['Q34']],
  ])
  assert.deepEqual(control.children.map(option => option.value), [...expected.keys()])
  for (const [reason, ids] of expected) {
    changeDemoFilter(control, 'value', reason)
    assert.deepEqual(results.children.map(({ tag, children: [summary] }) => {
      assert.equal(tag, 'details')
      assert.equal(summary.tag, 'summary')
      return demoExposedText(summary).split(' ')[0]
    }), ids, reason || '全部原因')
    assert.equal(byId('result-count').textContent, `${reason || '全部原因'}，共 ${ids.length} 道失败题目。`)
  }

  changeDemoFilter(control, 'value', '')
  const root = demoAncestors(control).at(-1)
  pressDemoKey(root, 'Tab')
  assert.equal(root.activeElement.attributes.get('href'), '/')
  pressDemoKey(root, 'Tab')
  assert.equal(root.activeElement, control)
  pressDemoKey(root, 'ArrowDown')
  assert.equal(control.value, '被相似段落挤掉')
  assert.equal(root.activeElement, control)
  pressDemoKey(root, 'Tab')
  const [summary, body] = results.children[0].children
  const { question, gold } = retrievalBundle.questions.find(item => item.id === 'Q03')
  assert.equal(root.activeElement, summary)
  assert.equal(demoExposedText(summary), `Q03 ${question}`)
  assert.ok(!visibleDemoElements(results).includes(body))
  pressDemoKey(root, 'Enter')
  assert.ok(visibleDemoElements(results).includes(body))
  assert.match(demoExposedText(body), /失败原因：被相似段落挤掉/)
  assert.equal(body.children.find(node => node.tag === 'blockquote').textContent, gold)
  const [{ chunk }] = retrievalBundle.configs['heading/bm25/1'].results.Q03.top
  const chunkText = body.children.find(node => node.className === 'failure')
    .children.find(node => node.tag === 'ol').children[0].children[1]
  assert.equal(chunkText.textContent, retrievalBundle.chunks.heading[chunk].text)
})

test('retrieval announces loading, empty results and fetch errors', async t => {
  for (const [name, ok, message] of [
    ['empty export', true, '没有可展示的评测结果。'],
    ['failed fetch', false, '评测数据加载失败。请刷新页面重试。'],
  ]) {
    await t.test(name, async subtest => {
      let loading
      const byId = await mountDemo(subtest, retrievalDir, { ...retrievalBundle, configs: {} }, {
        ok,
        onLoading: byId => { loading = byId('result-count').textContent },
      })
      assert.equal(loading, '正在加载评测数据。')
      assert.equal(byId('result-count').textContent, message)
      assert.ok(byId('filters').disabled)
      assert.ok(byId('recommendation').hidden)
    })
  }
})

test('actions renders all 13 scenarios in keyboard order with the exported plan and outcomes', async t => {
  const byId = await mountDemo(t, actionsDir, actionsBundle)
  const scenarios = byId('scenarios').children
  assert.equal(byId('result-count').textContent, '共 13 个场景。')
  assert.equal(scenarios.length, 13, 'Every exported scenario needs its own disclosure')
  const root = demoAncestors(scenarios[0]).at(-1)
  pressDemoKey(root, 'Tab')
  assert.equal(root.activeElement.attributes.get('href'), '/')

  const expected = [
    ['正常查单', '查订单 A-101', '成功', [
      ['lookup_order', '订单号：A-101', '只读', '无需审批', '实付 259 元，未发货。'],
    ]],
    ['改地址', 'A-101 改地址 青柚路***', '成功', [
      ['change_address', '新地址：青柚路***，订单号：A-101', '低风险', '无需审批', '地址已更新。'],
    ]],
    ['退款审批', '我的订单 A-102 退款 199 元', '成功', [
      ['refund', '退款金额（元）：199，订单号：A-102', '高风险', '人工已批准', '已退款 199 元。'],
    ]],
    ['重复批准', '我的订单 A-102 退款 199 元', '成功', [
      ['refund', '退款金额（元）：199，订单号：A-102', '高风险', '人工已批准', '已退款 199 元。'],
    ]],
    ['超时后查询确认', '我的订单 A-101 退款 39 元', '成功', [
      ['refund', '退款金额（元）：39，订单号：A-101', '高风险', '人工已批准', '已退款 39 元。'],
    ]],
    ['越权被拒', '查订单 B-201', '已拒绝', [
      ['lookup_order', '订单号：B-201', '只读', '无需审批', '已拒绝。原因：无权操作该订单。'],
    ]],
    ['坏计划被拒', '坏计划', '已拒绝', [
      ['list_orders', '账户：A', '只读', '无需审批', '未执行。原因：计划含白名单外的工具。'],
      ['delete_order', '无', '未评级', '工具已拦下，未进入审批', '已拒绝。原因：工具不在白名单。'],
    ]],
  ]

  for (const [index, [name, request, outcome, steps]] of expected.entries()) {
    const details = scenarios[index]
    const [summary, body] = details.children
    assert.equal(details.tag, 'details', name)
    assert.equal(summary.tag, 'summary', name)
    assert.equal(demoExposedText(summary), name, `读屏可读到折叠控件名称：${name}`)
    assert.ok(!visibleDemoElements(details).includes(body), `${name} starts collapsed`)
    pressDemoKey(root, 'Tab')
    assert.ok(root.activeElement === summary, `Tab can reach ${name}`)
    pressDemoKey(root, 'Enter')
    assert.ok(visibleDemoElements(details).includes(body), `Enter opens ${name}`)
    assert.equal(body.children[0].textContent, `用户请求（账户 A）：“${request}”`)
    const heading = body.children.find(node => node.tag === 'h3')
    assert.equal(demoExposedText(heading), `${name}：工具调用计划`, `读屏可读到展开后的标题：${name}`)
    const plan = body.children.find(node => node.tag === 'ol')
    assert.equal(plan.children.length, steps.length, name)
    for (const [position, expectedFields] of steps.entries()) {
      const item = plan.children[position]
      assert.equal(item.tag, 'li')
      const labels = ['工具', '参数', '风险级别', '审批状态', '结果']
      assert.deepEqual(demoFacts(item.children.find(node => node.tag === 'dl'), demoExposedText),
        labels.map((label, field) => [label, expectedFields[field]]), name)
    }
    assert.equal(demoExposedText(body.children.at(-1)), `最终状态：${outcome}。`, `读屏可读到展开后的结果：${name}`)
  }

  assert.match(scenarios[2].textContent, /先进入待审，人工批准后才执行/)
  assert.match(scenarios[3].textContent, /重复批准.*只有 1 笔退款，没有退第二次/)
  const duplicateApprovalScenarios = scenarios
    .filter(({ children: [, body] }) => /人工[^。]*重复批准/.test(body.textContent))
    .map(({ children: [summary] }) => summary.textContent)
  assert.deepEqual(duplicateApprovalScenarios, ['重复批准'], '只有重复批准场景可以显示人工重复批准说明')
  assert.match(scenarios[4].textContent, /结果一度不明.*先按原操作编号查询.*确认已退款.*没有重试/)

  const m2 = [
    ['可疑订单备注', '场景说明（账户 B）：测试脚本先查订单 B-202 和 B-203，再尝试用 B-203 的订单备注作为退款金额。',
      '已拒绝', 3, /标记可疑指令.*工具已拦下，未进入审批.*参数来自带可疑指令的工具结果/],
    ['每分钟工具限额', '场景说明（账户 A）：在同一分钟查订单 A-101 共 11 次。',
      '已拒绝', 11, /该账户每分钟最多调用 10 次工具/],
    ['分钟限额重置', '场景说明（账户 A）：下一分钟再查订单 A-101。',
      '成功', 1, /订单号：A-101.*实付 259 元/],
    ['每日退款限额', '场景说明（账户 B）：当天为订单 B-201 连续发起 3 笔 10 元退款。',
      '已拒绝', 3, /该账户每天最多退款 2 次/],
    ['每日限额重置', '场景说明（账户 B）：次日为订单 B-201 退款 10 元。',
      '成功', 1, /订单号：B-201.*已退款 10 元/],
    ['大额退款双人审批', '用户请求（账户 A）：“A-103 退款 600 元”',
      '成功', 1, /第一位批准后，状态为待审.*同一人重复批准后，状态仍为待审.*共收到 2 位审批人的批准。已退款 600 元/],
  ]
  for (const [index, [name, introduction, outcome, steps, evidence]] of m2.entries()) {
    const details = scenarios[expected.length + index]
    const [summary, body] = details.children
    assert.equal(details.tag, 'details', name)
    assert.equal(summary.tag, 'summary', name)
    assert.equal(demoExposedText(summary), name)
    assert.ok(!visibleDemoElements(details).includes(body), `${name} starts collapsed`)
    pressDemoKey(root, 'Tab')
    assert.equal(root.activeElement, summary, `Tab can reach ${name}`)
    pressDemoKey(root, 'Enter')
    assert.ok(visibleDemoElements(details).includes(body), `Enter opens ${name}`)
    assert.equal(demoExposedText(body.children[0]), introduction, name)
    assert.equal(body.children.find(node => node.tag === 'ol').children.length, steps, name)
    assert.match(demoExposedText(body), evidence, name)
    assert.equal(demoExposedText(body.children.at(-1)), `最终状态：${outcome}。`, name)
  }
  assert.equal(byId('source').textContent, '数据来源：support-actions，提交 a62bebb。')
  pressDemoKey(root, 'Tab')
  assert.equal(root.activeElement.attributes.get('href'), 'https://github.com/xoqiu09/support-actions')
})

test('actions reports the approval and result of each daily-limit refund separately', async t => {
  const byId = await mountDemo(t, actionsDir, actionsBundle)
  const dailyLimit = byId('scenarios').children.find(node => node.children[0].textContent === '每日退款限额')
  dailyLimit.children[0].focus()
  pressDemoKey(demoAncestors(dailyLimit).at(-1), 'Enter')
  const refunds = dailyLimit.children[1].children.find(node => node.tag === 'ol').children
  const approvalAndResults = refunds.map(refund => {
    const fields = Object.fromEntries(demoFacts(refund.children.find(node => node.tag === 'dl'), demoExposedText))
    return [fields['审批状态'], fields['结果']]
  })
  assert.deepEqual(approvalAndResults, [
    ['人工已批准', '已退款 10 元。'],
    ['人工已批准', '已退款 10 元。'],
    ['人工已批准', '已拒绝。原因：该账户每天最多退款 2 次。'],
  ])
  assert.deepEqual(refunds[2].children.filter(node => node.tag === 'p').slice(1).map(demoExposedText), [
    '人工已批准，当日额度已用完，本笔未退款。',
  ])
})

test('actions announces loading, empty results and fetch errors without hiding its links', async t => {
  for (const [name, ok, message] of [
    ['empty export', true, '没有可展示的场景。'],
    ['failed fetch', false, '演示数据加载失败。请刷新页面重试。'],
  ]) {
    await t.test(name, async subtest => {
      let loading
      const byId = await mountDemo(subtest, actionsDir, { ...actionsBundle, scenarios: [], m2_scenarios: [] }, {
        ok,
        onLoading: byId => { loading = byId('result-count').textContent },
      })
      assert.equal(loading, '正在加载演示数据。')
      assert.equal(byId('result-count').textContent, message)
      assert.equal(byId('scenarios').children.length, 0)
      const root = demoAncestors(byId('result-count')).at(-1)
      pressDemoKey(root, 'Tab')
      assert.equal(root.activeElement.attributes.get('href'), '/')
      pressDemoKey(root, 'Tab')
      assert.equal(root.activeElement.attributes.get('href'), 'https://github.com/xoqiu09/support-actions')
    })
  }
})

test('answer-check counts two failed questions separately from three reasons', async t => {
  const bundle = structuredClone(answerCheckBundle)
  const selected = row => ['c03', 'c04'].includes(row.case_id ?? row.id)
  bundle.cases = bundle.cases.filter(selected)
  for (const bot of Object.values(bundle.bots)) {
    bot.answers = bot.answers.filter(selected)
    bot.labels = bot.labels.filter(selected)
    bot.report.cases = bot.report.cases.filter(selected)
    const failed = bot.report.cases.filter(row => row.verdict === 'fail')
    bot.report.summary = {
      total: 2,
      pass: 2 - failed.length,
      by_reason: Object.fromEntries(Object.keys(LABEL_NAMES).map(code => [code,
        failed.flatMap(row => row.reasons).filter(reason => reason.label === code).length])),
    }
  }
  const byId = await mountDemo(t, answerCheckDir, bundle)
  const [naive] = byId('scores').children
  assert.match(naive.textContent, /2 题中，0 题通过，2 题不通过。.*同一道题可能计入多项原因。.*事实不对/s)
  assert.equal(demoFacts(naive.children.find(node => node.tag === 'dl'))
    .reduce((total, [, count]) => total + Number(count), 0), 3)
})

test('answer-check announces both equal-count category changes', async t => {
  const byId = await mountDemo(t, answerCheckDir, answerCheckBundle)
  for (const [value, label, firstId] of [
    ['out_of_scope', '超出知识库', 'c15'], ['policy_edge', '规则边界', 'c26'],
  ]) {
    changeDemoFilter(byId('category'), 'value', value)
    const [first] = byId('cases').children
    assert.equal(first.children[0].textContent.split('，', 1)[0], firstId)
    assert.equal(byId('result-count').textContent, `naive，全部判定，${label}：找到 5 道题。`)
  }
})

test('watch announces equal-count changes and tabs from the filter to the first recovery', async t => {
  const byId = await mountDemo(t, watchDir, watchBundle)
  const control = byId('alert-type')
  const root = demoAncestors(control).at(-1)
  control.focus()
  for (const [value, label] of [['timeout_streak', '连续超时'], ['recovered', '恢复']]) {
    pressDemoKey(root, 'ArrowDown')
    assert.equal(control.value, value)
    assert.ok(root.activeElement === control, `${label}筛选后焦点应留在筛选框`)
    const [first] = byId('alerts').children
    assert.equal(first.children[0].children[0].textContent, label)
    assert.equal(byId('result-count').textContent, `${label}，共 3 条事件。`)
  }
  const [firstRecovery] = byId('alerts').children
  pressDemoKey(root, 'Tab')
  assert.ok(root.activeElement === firstRecovery.children[0], 'Tab 应聚焦第一条恢复记录')
})

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
    const naive = cards.find(card => card.children[0].textContent === 'naive')
    assert.equal(naive.children.find(child => child.className === 'score').textContent,
      '40 题中，10 题通过，30 题不通过。')
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
      const agreementFilter = disagreements.checked ? '，只看不一致' : ''
      const count = `${botName}，全部判定，全部类别${agreementFilter}：找到 ${ids.length} 道题。`
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
  const orderPreference = [['订单筛选', '只看未发货订单。写入时间 北京时间，2026 年 1 月 1 日 8 时整']]
  const expectedPreferences = [
    orderPreference, orderPreference, '账户 B 没有已保存的偏好。',
    '账户 A 没有已保存的偏好。', '账户 A 没有已保存的偏好。',
    [['称呼', '王先生[手机号已遮盖]。写入时间 北京时间，2026 年 1 月 1 日 8 时 0 分 5 秒']],
  ]
  for (const [index, step] of steps.entries()) {
    const { input, answer } = memoryBundle.steps[index]
    const [summary, body] = step.children
    const who = input.command === 'chat'
      ? `账户 ${input.account} 在会话 ${input.session} 说：“${input.message}”`
      : '账户 A 执行清除全部偏好的命令（独立于会话）'
    assert.equal(summary.textContent, `第 ${index + 1} 步，${who}`)
    const [replyTitle, reply, preferenceTitle, preferences] = body.children
    const context = `第 ${index + 1} 步，账户 ${input.account}，`
    assert.equal(replyTitle.textContent, context + (input.command === 'chat' ? '客服回复' : '命令结果'))
    assert.equal(reply.textContent, answer, `第 ${index + 1} 步的回复`)
    assert.equal(preferenceTitle.textContent, `${context}保存的偏好`)
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

test('memory headings distinguish the account A and account B replies', async t => {
  const byId = await mountDemo(t, memoryDir, memoryBundle)
  const [, second, third] = byId('steps').children
  const root = demoAncestors(second).at(-1)
  for (const step of [second, third]) {
    step.children[0].focus()
    pressDemoKey(root, 'Enter')
  }
  assert.ok(second.open && third.open, '第 2、3 步应同时展开')
  const headings = visibleDemoElements(byId('steps')).filter(node => node.tag === 'h3' &&
    demoAncestors(node).every(parent => parent.ariaHidden !== 'true' && parent.attributes.get('aria-hidden') !== 'true'))
    .map(node => node.textContent)
  assert.deepEqual(headings, [
    '第 2 步，账户 A，客服回复', '第 2 步，账户 A，保存的偏好',
    '第 3 步，账户 B，客服回复', '第 3 步，账户 B，保存的偏好',
  ])
})

test('memory speaks the saved UTC timestamp in Beijing time', async t => {
  const byId = await mountDemo(t, memoryDir, memoryBundle)
  const [first] = byId('steps').children
  const preferences = first.children[1].children[3]
  const time = preferences.children[0].children[1].children.find(node => node.tag === 'time')
  assert.equal(time.textContent, '北京时间，2026 年 1 月 1 日 8 时整')
  assert.equal(time.attributes.get('datetime'), '2026-01-01T00:00:00Z')
})

test('memory renders the consent replay, window budget and value-free audit', async t => {
  const byId = await mountDemo(t, memoryDir, memoryBundle)
  const { consent, first_answer, same_session_answer, new_session_answer, history, audit } = memoryBundle.m2
  const [consentCard] = byId('consent').children
  const paragraphs = consentCard.children.filter(node => node.tag === 'p').map(node => node.textContent)
  assert.deepEqual(paragraphs, [
    '账户 A 的跨会话偏好保存：关闭。', consent.answer, '跨会话保存的偏好：0 项。',
    first_answer, same_session_answer, new_session_answer,
  ])
  assert.notEqual(same_session_answer, new_session_answer)
  assert.deepEqual(consentCard.children.filter(node => node.tag === 'h3').map(node => node.textContent), [
    '账户 A，说「以后只看未发货的」之后', '账户 A，在同一会话再次查询', '账户 A，换到新会话再查询',
  ])

  const [historyCard] = byId('history').children
  // The pinned Python export has 511 characters in the compact window payload.
  assert.equal(historyCard.children[0].textContent, '账户 A 的会话 a1 保留了最近 6 轮对话和 1 条摘要。')
  assert.equal(historyCard.children[1].textContent, '按字符数估算共用 256 个 token，上限 400 个。')
  assert.deepEqual(historyCard.children.filter(node => node.tag === 'h3').map(node => node.textContent), [
    '账户 A，会话 a1，较早的对话摘要', '账户 A，会话 a1，最近的对话',
  ])
  const summaryList = historyCard.children.find(node => node.tag === 'ul')
  assert.deepEqual(summaryList.children.map(node => node.textContent), history.summary.map(({ user }) => user))
  const turnList = historyCard.children.find(node => node.tag === 'ol')
  assert.deepEqual(turnList.children.map(node => node.children.map(paragraph => paragraph.textContent)),
    history.turns.map(({ user, reply }) => [`顾客：${user}`, `客服：${reply}`]))

  const [auditCard] = byId('audit').children
  const actions = { read: '读取', write: '写入', delete: '删除' }
  assert.match(auditCard.children[0].textContent, /^共 9 条/)
  const auditList = auditCard.children.find(node => node.tag === 'ul')
  assert.deepEqual(auditList.children.map(node => {
    const [time, ...facts] = node.children
    return [time.tag, time.attributes.get('datetime'), facts.join('')]
  }), audit.map(({ time, account, session, action }) =>
    ['time', time, `，${actions[action]}，账户 ${account}，会话 ${session}，订单筛选`]))
  assert.equal(auditList.children[0].children[0].textContent, '北京时间，2026 年 1 月 1 日 8 时整')
  assert.equal(auditList.children.at(-1).children[0].textContent, '北京时间，2026 年 1 月 1 日 8 时 0 分 9 秒')
})

test('watch speaks alert and request seconds in Beijing time', async t => {
  const byId = await mountDemo(t, watchDir, watchBundle)
  const [first, firstRecovery] = byId('alerts').children
  const [heading, body] = first.children
  const [, secondRequest] = body.children.find(node => node.tag === 'ul').children
  const times = [heading.children.find(node => node.tag === 'time'),
    secondRequest.children[1].children[0].children[1].children[0]]
  for (const time of times) {
    assert.equal(time.textContent, '北京时间，2026 年 11 月 27 日 10 时 0 分 45 秒')
    assert.equal(time.tag, 'time')
    assert.equal(time.attributes.get('datetime'), '2026-11-27T10:00:45+08:00')
  }

  const [recoveryHeading, recoveryBody] = firstRecovery.children
  const [request] = recoveryBody.children.find(node => node.tag === 'ul').children
  assert.equal(request.children[0].textContent, '请求编号 r0003')
  const recoveryTimes = [recoveryHeading.children.find(node => node.tag === 'time'),
    request.children[1].children[0].children[1].children[0]]
  for (const time of recoveryTimes) {
    assert.equal(time.textContent, '北京时间，2026 年 11 月 27 日 10 时 1 分 30 秒')
    assert.equal(time.tag, 'time')
    assert.equal(time.attributes.get('datetime'), '2026-11-27T10:01:30+08:00')
  }
})

function assertDemoTable(table, title, columns, rows) {
  assert.equal(table.tag, 'table')
  const [caption, thead, tbody] = table.children
  assert.deepEqual([caption.tag, thead.tag, tbody.tag], ['caption', 'thead', 'tbody'])
  assert.equal(caption.textContent, title)
  const headers = thead.children[0].children
  assert.deepEqual(headers.map(cell => cell.textContent), columns)
  assert.ok(headers.every(cell => cell.tag === 'th' && cell.attributes.get('scope') === 'col'))
  for (const { children: [header, ...data] } of tbody.children) {
    assert.equal(header.tag, 'th')
    assert.equal(header.attributes.get('scope'), 'row')
    assert.ok(data.every(cell => cell.tag === 'td'))
  }
  assert.deepEqual(tbody.children.map(row => row.children.map(cell => cell.textContent)), rows)
}

test('watch renders both cost tables and the daily comparison flags with their numbers', async t => {
  const byId = await mountDemo(t, watchDir, watchBundle)
  const [users, models] = byId('cost').children
  assertDemoTable(users, '按用户看费用', ['用户', '费用', '未定价模型'], [
    ['user-1', '106.6268 元', '无'], ['user-2', '4.8868 元', '无'], ['user-3', '5.1718 元', '无'],
  ])
  assertDemoTable(models, '按模型看费用', ['模型', '费用'], [
    ['model-a', '107.0453 元'], ['model-b', '9.6400 元'],
  ])

  const [{ children: [comparison, table] }] = byId('report').children
  assert.equal(comparison.textContent, '与前一天比较：变慢、失败变多、费用上涨。')
  assertDemoTable(table, '日报指标', ['指标', '2026 年 11 月 28 日', '2026 年 11 月 27 日'], [
    ['调用数', '5', '200'], ['延迟 p95（毫秒）', '2600', '1687'], ['成功率', '40.00%', '92.50%'],
    ['费用', '80.1425 元', '36.5428 元'], ['输入 token', '50', '2374'], ['输出 token', '20020', '7567'],
    ['未定价模型数', '0', '0'],
  ])
  assert.deepEqual(table.children[1].children[0].children.slice(1).map(cell => {
    const [time] = cell.children
    return [time.tag, time.attributes.get('datetime')]
  }), [['time', '2026-11-28'], ['time', '2026-11-27']])
})

test('watch keeps unpriced calls distinct from zero cost and shows a report without a prior day', async t => {
  const bundle = structuredClone(watchBundle)
  bundle.summary.by_user['user-1'].unpriced_models = ['model-b']
  Object.assign(bundle.summary.by_user['user-2'], { cost: '未定价', unpriced_models: ['model-b'] })
  bundle.summary.by_user['user-3'].cost = 0
  bundle.summary.by_model['model-b'].cost = '未定价'
  bundle.report.comparison = { previous: null, previous_date: '2026-11-27', message: '没有前一天的数据', flags: [] }
  const byId = await mountDemo(t, watchDir, bundle)
  const [users, models] = byId('cost').children
  assertDemoTable(users, '按用户看费用', ['用户', '费用', '未定价模型'], [
    ['user-1', '106.6268 元', 'model-b'], ['user-2', '未定价', 'model-b'], ['user-3', '0.0000 元', '无'],
  ])
  assertDemoTable(models, '按模型看费用', ['模型', '费用'], [
    ['model-a', '107.0453 元'], ['model-b', '未定价'],
  ])
  const [{ children: [comparison, table] }] = byId('report').children
  assert.equal(comparison.textContent, '与前一天比较：没有前一天的数据。')
  assert.deepEqual(table.children[1].children[0].children.map(cell => cell.textContent), ['指标', '2026 年 11 月 28 日'])
})

test('watch renders scoped tables and keeps the live alert list in sync with the control', async t => {
  const byId = await mountDemo(t, watchDir, watchBundle)
  assert.match(byId('overview-status').textContent, /205 次有效调用.*2 行/)

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
    assert.deepEqual(details.map(({ tag, children: [heading] }) => {
      const [type, subject, time] = heading.children
      return [tag, heading.tag, type.textContent + subject, time.tag, time.attributes.get('datetime')]
    }), expected.map(alert => ['details', 'summary', `${optionLabels[alert.type]}，${alert.model ?? alert.user}，`, 'time', alert.ts]))
    const type = byId('alert-type').value
    assert.equal(byId('result-count').textContent, `${optionLabels[type]}，共 ${expected.length} 条事件。`)
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
        const facts = item.children[1]
        const [timeLabel, timeValue] = facts.children[0].children
        const [time] = timeValue.children
        assert.equal(timeLabel.textContent, '时间')
        assert.equal(time.tag, 'time')
        assert.equal(time.attributes.get('datetime'), record.ts)
        assert.deepEqual(demoFacts(facts).slice(1), [
          ['用户', record.user], ['模型', record.model], ['状态', statusLabels[record.status]],
          ['延迟（毫秒）', String(record.latency_ms)], ['输入 token', String(record.tokens_in)], ['输出 token', String(record.tokens_out)],
        ], `请求 ${id} 的调用明细`)
      }
    }
  })

  await t.test('both budget alert bodies show the Chinese date and its original datetime', () => {
    const budgetAlerts = byId('alerts').children.filter((_, index) => alerts[index].type === 'budget_exceeded')
    assert.deepEqual(budgetAlerts.map(({ children: [, body] }) => {
      const [budget] = body.children
      assert.equal(budget.tag, 'p')
      const [date] = budget.children
      assert.equal(date.tag, 'time')
      return [date.textContent, date.attributes.get('datetime')]
    }), [
      ['2026 年 11 月 27 日', '2026-11-27'],
      ['2026 年 11 月 28 日', '2026-11-28'],
    ])
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
