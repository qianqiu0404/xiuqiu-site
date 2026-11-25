import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, NodeTypes } from '@vue/compiler-dom'
import { renderToString } from '@vue/server-renderer'
import vue from '@vitejs/plugin-vue'
import { createServer } from 'vite'
import { createSSRApp, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
  adjacentProjectId, filterResumeProjects, normalizeCategory, projectIdFromHash,
} from '../src/features/resume/presentation.ts'

const resumeDir = new URL('../src/features/resume/', import.meta.url)
const records = JSON.parse(readFileSync(new URL('records.json', resumeDir)))
const demoHref = '/mini-exchange-demo/index.html'
let page
let notes

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
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: ResumePage, alias: ['/intel', '/radar', '/articles'] }],
    })
    const app = createSSRApp({ render: () => h(ResumePage) }).use(router)
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

test('resume features eight catalog entries in the approved order', () => {
  const cards = featuredCards()
  assert.deepEqual(cards.map(card => attribute(featuredTitleButton(card), 'data-open')), [
    'saas', 'miniexchange', 'steward', 'qai', 'xiaomao', 'qiumarket', 'wildheart', 'qiwu',
  ])
  assert.deepEqual(cards.map(card => {
    const [meta] = elements(card, withClass('card-meta'))
    return text(meta.children.find(child => child.tag === 'span'))
  }), [
    '01 / 08', '02 / 08', '03 / 08', '04 / 08', '05 / 08', '06 / 08', '07 / 08', '08 / 08',
  ])
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
  assert.ok(existsSync(new URL(`../public${demoHref}`, import.meta.url)))
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
