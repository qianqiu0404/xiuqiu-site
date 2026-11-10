import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'
import { build, createServer } from 'vite'
import { dailyRadars as allRadars } from '../src/data/generatedRadarAll.ts'
import { allMarketRadars } from '../src/data/generatedMarketRadarAll.ts'
import { parseRadarLoader, parseRadarMonth, radarEntryModules } from '../build/radarEntryModules.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const settings = {
  learning: { loader: 'generatedRadarLoader.ts', folder: 'generatedRadarMonths', array: 'monthlyRadars', type: 'DailyRadar', fn: 'loadRadarBySlug', entries: allRadars },
  market: { loader: 'generatedMarketRadarLoader.ts', folder: 'generatedMarketRadarMonths', array: 'monthlyMarketRadars', type: 'MarketRadarDaily', fn: 'loadMarketRadarBySlug', entries: allMarketRadars },
}
const originalLoader = kind => readFileSync(path.join(root, 'src/data', settings[kind].loader), 'utf8')
const hook = value => typeof value === 'function' ? value : value.handler
const json = value => JSON.parse(JSON.stringify(value))

function loader(kind, months) {
  const source = originalLoader(kind)
  const ast = ts.createSourceFile('loader.ts', source, ts.ScriptTarget.Latest, true)
  const map = ast.statements.find(ts.isVariableStatement).declarationList.declarations[0].initializer
  const imports = months.map(month => `'${month}': () => import('./${settings[kind].folder}/${month}.ts')`)
  return source.slice(0, map.getStart(ast)) + `{${imports.join(',')}}` + source.slice(map.getEnd())
}

function month(kind, entries) {
  const current = settings[kind]
  return `import type { ${current.type} } from '../generated.ts'\nexport const ${current.array}: ${current.type}[] = ${JSON.stringify(entries, null, 2)}\n`
}

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'radar-entry-'))
  writeFileSync(path.join(directory, 'package.json'), '{"type":"module"}')
  const data = path.join(directory, 'src/data')
  mkdirSync(data, { recursive: true })
  for (const kind of ['learning', 'market']) {
    mkdirSync(path.join(data, settings[kind].folder))
    writeFileSync(path.join(data, settings[kind].loader), loader(kind, ['2026-11']))
    writeFileSync(path.join(data, settings[kind].folder, '2026-11.ts'), month(kind, [
      { date: '2026-11-09', slug: '2026-11-09', schemaVersion: 2, marker: kind + '-new', payload: { checksum: 'preserved' } },
      { date: '2026-11-08', slug: '2026-11-08', marker: kind + '-legacy', body: 'unchanged legacy data' },
    ]))
  }
  return { directory, data, dispose: () => rmSync(directory, { recursive: true, force: true }) }
}

test('entry parsing preserves every current learning and market archive value including legacy records', () => {
  for (const kind of ['learning', 'market']) {
    const values = []
    const months = parseRadarLoader(originalLoader(kind), kind)
    for (const record of months) {
      const source = readFileSync(path.join(root, 'src/data', record.relativePath), 'utf8')
      values.push(...parseRadarMonth(source, kind, record.month))
    }
    assert.deepEqual(json(values), json(settings[kind].entries))
    assert.equal(values.length, settings[kind].entries.length)
    assert.ok(values.some(value => value.schemaVersion !== 2))
  }
})

test('loader and month parsing reject extra statements, changed behavior, unsafe data and duplicate dates', () => {
  for (const kind of ['learning', 'market']) {
    assert.throws(() => parseRadarLoader(originalLoader(kind) + '\nconsole.log("unexpected")', kind), /unsupported loader/)
    assert.throws(() => parseRadarLoader(originalLoader(kind).replace('.find(', '.filter('), kind), /behavior changed/)
    assert.throws(() => parseRadarLoader(loader(kind, ['2026-11', '2026-11']), kind), /duplicate month/)
    assert.throws(() => parseRadarLoader(loader(kind, ['2026-11']).replace('/2026-11.ts', '/other.ts'), kind), /does not match/)
    assert.throws(() => parseRadarLoader(originalLoader(kind).replace('return monthly', 'return (monthly'), kind), /invalid TypeScript syntax/)
    const record = { date: '2026-11-09', slug: '2026-11-09' }
    assert.throws(() => parseRadarMonth(month(kind, [record, record]), kind, '2026-11'), /duplicate entry/)
    assert.throws(() => parseRadarMonth(month(kind, [{ ...record, date: '2026-11-08' }]), kind, '2026-11'), /mismatched/)
    assert.throws(() => parseRadarMonth(month(kind, [record]), kind, '2026-12'), /mismatched/)
    assert.throws(() => parseRadarMonth(month(kind, [record]).replace('"2026-11-09"', '(() => "2026-11-09")()'), kind, '2026-11'), /non-JSON/)
    assert.throws(() => parseRadarMonth(month(kind, [record]) + '\nthrow new Error("not executed")', kind, '2026-11'), /unsupported month/)
    assert.throws(() => parseRadarMonth(month(kind, [record]).replace('import type', 'import'), kind, '2026-11'), /unsupported month/)
  }
})

test('Vite resolves only the requested daily module, preserves legacy values, skips unknown slugs and propagates errors', async () => {
  const f = fixture()
  const plugin = radarEntryModules()
  const loaded = []
  const original = hook(plugin.load)
  plugin.load = function (id, ...args) {
    if (id.startsWith('\0radar-entry/')) loaded.push(id)
    return original.call(this, id, ...args)
  }
  const server = await createServer({ root: f.directory, configFile: false, plugins: [plugin], server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  try {
    for (const kind of ['learning', 'market']) {
      const module = await server.ssrLoadModule('/src/data/' + settings[kind].loader)
      const load = module[settings[kind].fn]
      loaded.length = 0
      assert.equal(await load('invalid'), undefined)
      assert.equal(await load('2026-11-30'), undefined)
      assert.equal(await load('2026-12-01'), undefined)
      assert.deepEqual(loaded, [])
      const value = await load('2026-11-09')
      assert.equal(value.marker, kind + '-new')
      assert.deepEqual(value.payload, { checksum: 'preserved' })
      assert.deepEqual(loaded, ['\0radar-entry/' + kind + '/2026-11-09'])
      const source = path.join(f.data, settings[kind].folder, '2026-11.ts')
      const previous = readFileSync(source, 'utf8')
      writeFileSync(source, month(kind, [{ date: '2026-11-09', slug: '2026-11-09', marker: 'updated' }]))
      await assert.rejects(() => load('2026-11-08'), /no longer exists/)
      writeFileSync(source, previous)
      hook(plugin.handleHotUpdate)({ file: source, server })
      const refreshed = await server.ssrLoadModule('/src/data/' + settings[kind].loader)
      assert.equal((await refreshed[settings[kind].fn]('2026-11-08')).marker, kind + '-legacy')
      writeFileSync(source, month(kind, [{ date: '2026-11-09', slug: '2026-11-09', marker: 'fresh' }]))
      hook(plugin.handleHotUpdate)({ file: source, server })
      const changed = await server.ssrLoadModule('/src/data/' + settings[kind].loader)
      assert.equal((await changed[settings[kind].fn]('2026-11-09')).marker, 'fresh')
      const nextMonth = path.join(f.data, settings[kind].folder, '2026-12.ts')
      const loaderFile = path.join(f.data, settings[kind].loader)
      writeFileSync(nextMonth, month(kind, [{ date: '2026-12-01', slug: '2026-12-01', marker: 'added-month' }]))
      writeFileSync(loaderFile, loader(kind, ['2026-11', '2026-12']))
      server.watcher.emit('add', nextMonth)
      const added = await server.ssrLoadModule('/src/data/' + settings[kind].loader)
      assert.equal((await added[settings[kind].fn]('2026-12-01')).marker, 'added-month')
      rmSync(nextMonth)
      writeFileSync(loaderFile, loader(kind, ['2026-11']))
      server.watcher.emit('unlink', nextMonth)
      const removed = await server.ssrLoadModule('/src/data/' + settings[kind].loader)
      assert.equal(await removed[settings[kind].fn]('2026-12-01'), undefined)
    }
  } finally { await server.close(); f.dispose() }
})

test('dev add/unlink and source updates invalidate virtual entries and both loaders before full reload', () => {
  const f = fixture()
  const plugin = radarEntryModules()
  hook(plugin.configResolved)({ root: f.directory })
  const watcher = new EventEmitter()
  const httpServer = new EventEmitter()
  const modules = [
    { id: '\0radar-entry/learning/2026-11-09' },
    { id: '\0radar-entry/market/2026-11-09' },
    { id: path.join(f.data, settings.learning.loader) },
    { id: path.join(f.data, settings.market.loader) },
    { id: path.join(f.directory, 'src/app.ts') },
  ]
  const invalidated = []
  const messages = []
  const server = { watcher, httpServer, moduleGraph: { idToModuleMap: new Map(modules.map(m => [m.id, m])), invalidateModule: m => invalidated.push(m.id) }, ws: { send: m => messages.push(m) } }
  try {
    hook(plugin.configureServer)(server)
    for (const event of ['add', 'unlink']) {
      watcher.emit(event, path.join(f.data, 'generatedRadarMonths/2026-12.ts'))
      assert.deepEqual(invalidated.splice(0), modules.slice(0, 4).map(m => m.id))
      assert.deepEqual(messages.splice(0), [{ type: 'full-reload' }])
    }
    watcher.emit('add', path.join(f.directory, 'unrelated.ts'))
    assert.deepEqual(messages, [])
    assert.deepEqual(hook(plugin.handleHotUpdate)({ file: path.join(f.data, 'generatedMarketRadarMonths/2026-11.ts'), server }), [])
    assert.equal(invalidated.length, 4)
    assert.deepEqual(messages, [{ type: 'full-reload' }])
    httpServer.emit('close')
    assert.equal(watcher.listenerCount('add'), 0)
    assert.equal(watcher.listenerCount('unlink'), 0)
  } finally { f.dispose() }
})

test('production graph has one independent chunk per date and no whole-month runtime modules', async () => {
  const f = fixture()
  writeFileSync(path.join(f.directory, 'entry.js'), `export { loadRadarBySlug } from './src/data/generatedRadarLoader.ts'; export { loadMarketRadarBySlug } from './src/data/generatedMarketRadarLoader.ts'`)
  try {
    const result = await build({ root: f.directory, configFile: false, plugins: [radarEntryModules()], logLevel: 'silent', build: { write: false, minify: false, rollupOptions: { input: path.join(f.directory, 'entry.js'), preserveEntrySignatures: 'strict' } } })
    const chunks = result.output.filter(output => output.type === 'chunk')
    const entries = chunks.flatMap(chunk => Object.keys(chunk.modules).filter(id => id.startsWith('\0radar-entry/')).map(id => ({ id, chunk })))
    assert.equal(entries.length, 4)
    assert.equal(new Set(entries.map(x => x.chunk.fileName)).size, 4)
    assert.equal(chunks.some(chunk => Object.keys(chunk.modules).some(id => /generated(?:Market)?RadarMonths\//.test(id))), false)
    const main = chunks.find(chunk => chunk.facadeModuleId?.endsWith('entry.js'))
    assert.equal(main.dynamicImports.length, 4)
    assert.equal(entries.every(x => x.chunk.dynamicImports.length === 0), true)
  } finally { f.dispose() }
})
