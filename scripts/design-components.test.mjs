import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderComponent } from './lib/render-vue.mjs'

const component = name => new URL(`../src/design/components/${name}.vue`, import.meta.url)

test('IntelCard links to the brief and shows domain, flags and source', async () => {
  const html = await renderComponent(component('IntelCard'), {
    to: '/radar/2026-08-13#a1', domain: 'ai', topicLabel: 'agent', title: 'Title & <x>', summary: 'Why',
    sourceLabel: '一手来源 · OpenAI', continuing: true, deepDive: true,
  })
  assert.match(html, /href="\/radar\/2026-08-13#a1"/)
  assert.match(html, /brief-tag brief-tag--ai">AI</)
  assert.match(html, /持续追踪/)
  assert.match(html, /专题/)
  assert.match(html, /Title &amp; &lt;x&gt;/)
  assert.match(html, /一手来源 · OpenAI/)
})

test('IntelCard omits optional flags and source when absent', async () => {
  const html = await renderComponent(component('IntelCard'), {
    to: '/x', domain: 'web3', topicLabel: 'protocol', title: 'T', summary: 'S',
  })
  assert.doesNotMatch(html, /持续追踪|专题|brief-card-source|brief-tag--p0/)
})

test('ChipGroup exposes pressed state and counts for each option', async () => {
  const html = await renderComponent(component('ChipGroup'), {
    label: '按主题筛选', active: 'agent',
    options: [{ key: 'agent', label: 'agent', count: 3 }, { key: 'l2', label: 'l2' }],
  })
  assert.match(html, /role="group" aria-label="按主题筛选"/)
  assert.match(html, /class="active" aria-pressed="true"[^>]*>\s*agent <span>3<\/span>/)
  assert.match(html, /aria-pressed="false"[^>]*>\s*l2 <!--v-if-->/)
  assert.match(html, /class="brief-chips"/)
  const tabs = await renderComponent(component('ChipGroup'), { label: 'x', options: [], variant: 'tabs' })
  assert.match(tabs, /class="brief-tabs"/)
})

test('LoadState uses alert for errors and status with aria-busy for loading', async () => {
  const error = await renderComponent(component('LoadState'), { state: 'error', message: '失败', actionLabel: '重试' })
  assert.match(error, /role="alert"/)
  assert.match(error, /<button class="brief-button" type="button">重试<\/button>/)
  const loading = await renderComponent(component('LoadState'), { state: 'loading', message: '载入中' })
  assert.match(loading, /role="status" aria-busy="true"/)
  const empty = await renderComponent(component('LoadState'), { state: 'empty', message: '空', hint: '稍后再来' })
  assert.match(empty, /role="status"/)
  assert.doesNotMatch(empty, /aria-busy/)
  assert.match(empty, /稍后再来/)
})

test('SearchBox has an accessible label and SubscribeBar links every public feed', async () => {
  const search = await renderComponent(component('SearchBox'), { label: '搜索简报', modelValue: 'mcp' })
  assert.match(search, /<span class="brief-sr-only">搜索简报<\/span>/)
  assert.match(search, /type="search"[^>]*placeholder="搜索简报"/)
  assert.match(search, /value="mcp"/)
  const subscribe = await renderComponent(component('SubscribeBar'))
  for (const href of ['/radar/rss.xml', '/radar/feed.json', '/data/intel/latest.json', '/llms.txt']) assert.match(subscribe, new RegExp(`href="${href}"`))
})

function tokenBlock(css, selector) {
  const start = css.indexOf(`${selector} {`)
  assert.notEqual(start, -1, `tokens.css is missing ${selector}`)
  const block = css.slice(start, css.indexOf('\n}', start))
  return Object.fromEntries([...block.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)].map(match => [match[1], match[2].trim()]))
}

test('tokens: light defines every token once, dark overrides only colours and matches system dark', () => {
  const tokens = readFileSync(new URL('../src/design/tokens.css', import.meta.url), 'utf8')
  const lightBlock = tokens.slice(tokens.indexOf(':root {'), tokens.indexOf('\n}', tokens.indexOf(':root {')))
  const lightNames = [...lightBlock.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map(match => match[1])
  assert.equal(new Set(lightNames).size, lightNames.length, 'light theme defines a token twice')
  const forcedDark = tokenBlock(tokens, ':root[data-theme="dark"]')
  const systemDark = tokenBlock(tokens, '  :root:not([data-theme="light"])')
  assert.deepEqual(systemDark, forcedDark, 'system dark and forced dark must stay identical')
  for (const name of Object.keys(forcedDark)) assert.ok(lightNames.includes(name), `dark overrides unknown token ${name}`)

  const families = ['radar', 'market-radar', 'cinematic-pages', 'home', 'ai-evidence-os', 'product-pages']
    .map(name => readFileSync(new URL(`../src/styles/${name}.css`, import.meta.url), 'utf8'))
  const designCss = ['brief', 'shell'].map(name => readFileSync(new URL(`../src/design/${name}.css`, import.meta.url), 'utf8'))
  // Legacy globals still defined on :root in src/style.css until P6.
  const globalStyle = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
  const legacyNames = [...globalStyle.slice(globalStyle.indexOf(':root {'), globalStyle.indexOf('}', globalStyle.indexOf(':root {'))).matchAll(/^\s*(--[a-z0-9-]+):/gm)].map(match => match[1])
  for (const [, name] of [...families, ...designCss].join('\n').matchAll(/var\((--[a-z][a-z0-9-]*)[,)]/g)) {
    if (/^--(tag|flag|dot|track|priority|product|radar|trade|cinema|aeo|ledger|article)(-|$)/.test(name)) continue
    assert.ok(lightNames.includes(name) || legacyNames.includes(name), `${name} is used but defined nowhere`)
  }
  assert.doesNotMatch(families.join('\n'), /#030507/, 'night background must come from --night-bg')
})
