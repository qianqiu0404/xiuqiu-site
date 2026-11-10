import { readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import type { Plugin, ViteDevServer } from 'vite'

type Kind = 'learning' | 'market'
type Entry = Record<string, unknown> & { date: string; slug: string }
type Month = { month: string; relativePath: string }
const PREFIX = 'virtual:radar-entry/'
const RESOLVED = '\0radar-entry/'
const DATE = /^\d{4}-\d{2}-\d{2}$/
const printer = ts.createPrinter({ removeComments: true })
const descriptors = {
  learning: {
    loader: 'generatedRadarLoader.ts', directory: 'generatedRadarMonths',
    map: 'radarMonthLoaders', array: 'monthlyRadars', type: 'DailyRadar',
    fn: `export async function loadRadarBySlug(slug: string): Promise<DailyRadar | undefined> {
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(slug)) return undefined
      const loadMonth = radarMonthLoaders[slug.slice(0, 7)]
      if (!loadMonth) return undefined
      const { monthlyRadars } = await loadMonth()
      return monthlyRadars.find(radar => radar.slug === slug)
    }`,
    exportName: 'loadRadarBySlug',
  },
  market: {
    loader: 'generatedMarketRadarLoader.ts', directory: 'generatedMarketRadarMonths',
    map: 'loaders', array: 'monthlyMarketRadars', type: 'MarketRadarDaily',
    fn: `export async function loadMarketRadarBySlug(slug: string): Promise<MarketRadarDaily | undefined> {
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(slug)) return undefined
      const load = loaders[slug.slice(0, 7)]
      if (!load) return undefined
      const { monthlyMarketRadars } = await load()
      return monthlyMarketRadars.find(entry => entry.slug === slug)
    }`,
    exportName: 'loadMarketRadarBySlug',
  },
} as const

function sourceFile(source: string, filename: string) {
  const diagnostics = ts.transpileModule(source, {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).diagnostics
  if (diagnostics?.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)) {
    fail(filename, 'invalid TypeScript syntax')
  }
  return ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
}

function fail(filename: string, message: string): never {
  throw new Error(`Radar entry modules: ${filename}: ${message}`)
}

function typeImport(node: ts.Statement) {
  return ts.isImportDeclaration(node) && node.importClause?.isTypeOnly === true
}

function variable(node: ts.Statement, name: string, exported: boolean, filename: string) {
  if (!ts.isVariableStatement(node) || !(node.declarationList.flags & ts.NodeFlags.Const)
    || node.declarationList.declarations.length !== 1
    || Boolean(node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) !== exported) {
    fail(filename, `expected the ${name} constant`)
  }
  const declaration = node.declarationList.declarations[0]
  if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name || !declaration.initializer) {
    fail(filename, `unexpected ${name} declaration`)
  }
  return declaration.initializer
}

export function parseRadarLoader(source: string, kind: Kind): Month[] {
  const descriptor = descriptors[kind]
  const ast = sourceFile(source, descriptor.loader)
  if (ast.statements.length !== 3 || !typeImport(ast.statements[0])) {
    fail(descriptor.loader, 'unsupported loader statements')
  }
  const map = variable(ast.statements[1], descriptor.map, false, descriptor.loader)
  const fn = ast.statements[2]
  const expected = sourceFile(descriptor.fn, 'expected.ts').statements[0]
  if (!ts.isFunctionDeclaration(fn)
    || printer.printNode(ts.EmitHint.Unspecified, fn, ast)
      !== printer.printNode(ts.EmitHint.Unspecified, expected, sourceFile(descriptor.fn, 'expected.ts'))) {
    fail(descriptor.loader, 'loader behavior changed; review the entry transform before building')
  }
  if (!ts.isObjectLiteralExpression(map)) fail(descriptor.loader, 'month loaders must be an object')
  const seen = new Set<string>()
  return map.properties.map(property => {
    if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.name)
      || !ts.isArrowFunction(property.initializer) || property.initializer.parameters.length !== 0
      || property.initializer.modifiers?.length || !ts.isCallExpression(property.initializer.body)) {
      fail(descriptor.loader, 'unsupported month import')
    }
    const month = property.name.text
    const call = property.initializer.body
    if (!/^\d{4}-\d{2}$/.test(month) || seen.has(month)
      || call.expression.kind !== ts.SyntaxKind.ImportKeyword || call.arguments.length !== 1
      || !ts.isStringLiteral(call.arguments[0])) fail(descriptor.loader, 'invalid or duplicate month import')
    const relativePath = `./${descriptor.directory}/${month}.ts`
    if (call.arguments[0].text !== relativePath) fail(descriptor.loader, 'month path does not match its key')
    seen.add(month)
    return { month, relativePath }
  })
}

export function parseRadarMonth(source: string, kind: Kind, month: string): Entry[] {
  const descriptor = descriptors[kind]
  const filename = `${descriptor.directory}/${month}.ts`
  const ast = sourceFile(source, filename)
  if (ast.statements.length !== 2 || !typeImport(ast.statements[0])) fail(filename, 'unsupported month statements')
  const initializer = variable(ast.statements[1], descriptor.array, true, filename)
  if (!ts.isArrayLiteralExpression(initializer)) fail(filename, 'month must contain a JSON array')
  let parsed: unknown
  try { parsed = JSON.parse(initializer.getText(ast)) } catch { fail(filename, 'month contains non-JSON data') }
  if (!Array.isArray(parsed)) fail(filename, 'month must contain an array')
  const seen = new Set<string>()
  for (const value of parsed) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || typeof value.slug !== 'string' || !DATE.test(value.slug)
      || value.date !== value.slug || value.slug.slice(0, 7) !== month || seen.has(value.slug)) {
      fail(filename, 'invalid, mismatched or duplicate entry date')
    }
    seen.add(value.slug)
  }
  return parsed as Entry[]
}

export function createRadarEntryLoader(kind: Kind, slugs: string[]) {
  const imports = slugs.map(slug => {
    if (!DATE.test(slug)) throw new Error('Invalid Radar entry date')
    return `${JSON.stringify(slug)}: () => import(${JSON.stringify(PREFIX + kind + '/' + slug)})`
  })
  return `const entries = {${imports.join(',')}};\nexport async function ${descriptors[kind].exportName}(slug) {
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(slug)) return undefined;
    const load = entries[slug];
    if (!load) return undefined;
    const { default: entry } = await load();
    return entry;
  }\n`
}

export function radarEntryModules(): Plugin {
  let root = ''
  let configuredRoot = ''
  const parsed = new Map<string, { source: string; entries: Entry[] }>()
  // Vite normally resolves module IDs through symlinks. Map its logical root
  // to that same real root, including watcher paths whose files were deleted.
  function canonicalPath(filename: string) {
    const absolute = path.resolve(filename)
    return absolute === configuredRoot || absolute.startsWith(configuredRoot + path.sep)
      ? path.resolve(root, path.relative(configuredRoot, absolute))
      : absolute
  }
  const dataDirectory = () => path.join(root, 'src/data')
  const loaderPath = (kind: Kind) => path.join(dataDirectory(), descriptors[kind].loader)
  const kinds: Kind[] = ['learning', 'market']
  const kindForLoader = (filename: string) => kinds.find(kind => canonicalPath(filename) === loaderPath(kind))
  const relevant = (filename: string) => kindForLoader(filename) !== undefined || kinds.some(kind =>
    path.dirname(canonicalPath(filename)) === path.join(dataDirectory(), descriptors[kind].directory))

  // Read current bytes on every request. Parsing is memoized by the full source,
  // never by mtime, so same-timestamp rewrites cannot return an old entry.
  function catalog(kind: Kind, watch?: (filename: string) => void) {
    const filename = loaderPath(kind)
    watch?.(filename)
    const months = parseRadarLoader(readFileSync(filename, 'utf8'), kind)
    const entries = new Map<string, Entry>()
    for (const month of months) {
      const file = path.resolve(dataDirectory(), month.relativePath)
      watch?.(file)
      const source = readFileSync(file, 'utf8')
      let cached = parsed.get(file)
      if (!cached || cached.source !== source) {
        cached = { source, entries: parseRadarMonth(source, kind, month.month) }
        parsed.set(file, cached)
      }
      for (const entry of cached.entries) {
        if (entries.has(entry.slug)) fail(filename, 'duplicate entry across months')
        entries.set(entry.slug, entry)
      }
    }
    return entries
  }

  function invalidate(server: ViteDevServer) {
    parsed.clear()
    for (const module of server.moduleGraph.idToModuleMap.values()) {
      if (module.id?.startsWith(RESOLVED) || (module.id && kindForLoader(module.id.split('?')[0]))) {
        server.moduleGraph.invalidateModule(module)
      }
    }
    server.ws.send({ type: 'full-reload' })
  }

  return {
    name: 'radar-entry-modules',
    enforce: 'pre',
    configResolved(config) {
      configuredRoot = path.resolve(config.root)
      root = realpathSync.native(configuredRoot)
    },
    buildStart() {
      for (const kind of kinds) catalog(kind, filename => this.addWatchFile(filename))
    },
    resolveId(id) {
      if (!id.startsWith(PREFIX)) return null
      if (!/^virtual:radar-entry\/(learning|market)\/\d{4}-\d{2}-\d{2}$/.test(id)) throw new Error('Invalid virtual Radar entry')
      return RESOLVED + id.slice(PREFIX.length)
    },
    load(id) {
      if (!id.startsWith(RESOLVED)) return null
      const match = /^\0radar-entry\/(learning|market)\/(\d{4}-\d{2}-\d{2})$/.exec(id)
      if (!match) throw new Error('Invalid resolved Radar entry')
      const entry = catalog(match[1] as Kind, filename => this.addWatchFile(filename)).get(match[2])
      if (!entry) throw new Error('Radar entry no longer exists: ' + match[2])
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(entry))});\n`
    },
    transform(code, id) {
      const kind = kindForLoader(id.split('?')[0])
      if (!kind) return null
      parseRadarLoader(code, kind)
      const entries = catalog(kind, filename => this.addWatchFile(filename))
      return { code: createRadarEntryLoader(kind, [...entries.keys()]), map: null }
    },
    configureServer(server) {
      const changed = (filename: string) => { if (relevant(path.resolve(filename))) invalidate(server) }
      server.watcher.on('add', changed)
      server.watcher.on('unlink', changed)
      server.httpServer?.once('close', () => {
        server.watcher.off('add', changed)
        server.watcher.off('unlink', changed)
      })
    },
    handleHotUpdate(context) {
      if (relevant(path.resolve(context.file))) {
        invalidate(context.server)
        return []
      }
    },
    generateBundle(_options, bundle) {
      const wholeMonths = [...this.getModuleIds()].filter(id => kinds.some(kind =>
        canonicalPath(id.split('?')[0]).startsWith(path.join(dataDirectory(), descriptors[kind].directory) + path.sep)))
      if (wholeMonths.length) throw new Error('Browser bundle still imports whole Radar months: ' + wholeMonths.join(', '))
      const chunks = Object.values(bundle).filter(output => output.type === 'chunk').flatMap(chunk => {
        if (chunk.type !== 'chunk') return []
        const entries = Object.keys(chunk.modules).filter(id => id.startsWith(RESOLVED))
        if (entries.length > 1) throw new Error('Multiple Radar entries were merged into one chunk')
        return entries.map(id => ({ id: id.slice(1), file: chunk.fileName, bytes: Buffer.byteLength(chunk.code) }))
      })
      // This application includes both detail routes. Require every published
      // catalog date in the emitted graph: a missed transform must not pass 0/0.
      const expected = new Set(kinds.flatMap(kind => [...catalog(kind).keys()].map(slug => `radar-entry/${kind}/${slug}`)))
      const actual = new Set(chunks.map(chunk => chunk.id))
      const missing = [...expected].filter(id => !actual.has(id))
      const unexpected = [...actual].filter(id => !expected.has(id))
      if (missing.length || unexpected.length || actual.size !== chunks.length) {
        throw new Error('Radar entry graph coverage mismatch: ' + JSON.stringify({ missing, unexpected, duplicate: chunks.length - actual.size }))
      }
      console.info('[radar-entry-bundles] ' + JSON.stringify({ count: chunks.length, expectedCount: expected.size, wholeMonthModules: wholeMonths.length, chunks }))
    },
  }
}
