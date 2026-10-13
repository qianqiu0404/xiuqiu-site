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
  assert.match(html, /radar-feed-domain--ai">AI</)
  assert.match(html, /持续追踪/)
  assert.match(html, /专题/)
  assert.match(html, /Title &amp; &lt;x&gt;/)
  assert.match(html, /一手来源 · OpenAI/)
})

test('IntelCard omits optional flags and source when absent', async () => {
  const html = await renderComponent(component('IntelCard'), {
    to: '/x', domain: 'web3', topicLabel: 'protocol', title: 'T', summary: 'S',
  })
  assert.doesNotMatch(html, /持续追踪|专题|<small/)
})

test('ChipGroup exposes pressed state and counts for each option', async () => {
  const html = await renderComponent(component('ChipGroup'), {
    label: '按主题筛选', active: 'agent',
    options: [{ key: 'agent', label: 'agent', count: 3 }, { key: 'l2', label: 'l2' }],
  })
  assert.match(html, /role="group" aria-label="按主题筛选"/)
  assert.match(html, /class="active" aria-pressed="true"[^>]*>\s*agent <span>3<\/span>/)
  assert.match(html, /aria-pressed="false"[^>]*>\s*l2 <!--v-if-->/)
  assert.match(html, /class="radar-topic-chips"/)
  const tabs = await renderComponent(component('ChipGroup'), { label: 'x', options: [], variant: 'tabs' })
  assert.match(tabs, /class="radar-filter-line"/)
})

test('LoadState uses alert for errors and status with aria-busy for loading', async () => {
  const error = await renderComponent(component('LoadState'), { state: 'error', message: '失败', actionLabel: '重试' })
  assert.match(error, /role="alert"/)
  assert.match(error, /<button type="button">重试<\/button>/)
  const loading = await renderComponent(component('LoadState'), { state: 'loading', message: '载入中' })
  assert.match(loading, /role="status" aria-busy="true"/)
  const empty = await renderComponent(component('LoadState'), { state: 'empty', message: '空', hint: '稍后再来' })
  assert.match(empty, /role="status"/)
  assert.doesNotMatch(empty, /aria-busy/)
  assert.match(empty, /稍后再来/)
})

test('SearchBox has an accessible label and SubscribeBar links every public feed', async () => {
  const search = await renderComponent(component('SearchBox'), { label: '搜索简报', modelValue: 'mcp' })
  assert.match(search, /<span class="sr-only">搜索简报<\/span>/)
  assert.match(search, /type="search"[^>]*placeholder="搜索简报"/)
  assert.match(search, /value="mcp"/)
  const subscribe = await renderComponent(component('SubscribeBar'))
  for (const href of ['/radar/rss.xml', '/radar/feed.json', '/llms.txt']) assert.match(subscribe, new RegExp(`href="${href}"`))
})

test('every design token used by components and family aliases is defined once', () => {
  const tokens = readFileSync(new URL('../src/design/tokens.css', import.meta.url), 'utf8')
  const defined = [...tokens.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map(match => match[1])
  assert.equal(new Set(defined).size, defined.length, 'tokens.css defines a token twice')
  const families = ['radar', 'market-radar', 'cinematic-pages', 'home', 'ai-evidence-os', 'product-pages']
    .map(name => readFileSync(new URL(`../src/styles/${name}.css`, import.meta.url), 'utf8'))
    .join('\n')
  for (const [, name] of families.matchAll(/var\((--(?:night|paper|accent|status|font|radius|space|touch)-[a-z0-9-]+)\)/g)) {
    assert.ok(defined.includes(name), `${name} is used but not defined in tokens.css`)
  }
  assert.doesNotMatch(families, /#030507/, 'night background must come from --night-bg')
})
