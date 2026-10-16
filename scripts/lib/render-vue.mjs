// Renders a single-file component to HTML in node:test, using only the
// compiler and server renderer that ship with vue (no extra dependencies).
// Child <router-link> renders as a plain anchor so components stay testable
// without a router instance.

import { readFileSync } from 'node:fs'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from '@vue/server-renderer'

const RouterLinkStub = defineComponent({
  props: { to: { type: String, required: true } },
  setup(props, { slots, attrs }) {
    return () => h('a', { ...attrs, href: props.to }, slots.default?.())
  },
})

async function importSource(code, name) {
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${name}`
  return import(url)
}

export async function loadComponent(fileUrl) {
  const filename = fileUrl.pathname
  const { descriptor, errors } = parse(readFileSync(fileUrl, 'utf8'), { filename })
  if (errors.length) throw errors[0]
  const id = filename.split('/').pop()
  const script = descriptor.scriptSetup || descriptor.script
    ? compileScript(descriptor, { id, inlineTemplate: true, isProd: true })
    : undefined
  let code
  if (script) {
    code = script.content
  } else {
    const template = compileTemplate({ source: descriptor.template.content, filename, id })
    code = `${template.code}\nexport default { render }`
  }
  // Setup scripts compile to TypeScript; Node 22 strips the types itself.
  const { stripTypeScriptTypes } = await import('node:module')
  if (script && descriptor.scriptSetup?.lang === 'ts') code = stripTypeScriptTypes(code)
  code = code.replace(/from (['"])vue\1/g, `from '${import.meta.resolve('vue')}'`)
  return (await importSource(code, id)).default
}

export async function renderComponent(fileUrl, props = {}, { onEmit } = {}) {
  const component = await loadComponent(fileUrl)
  const app = createSSRApp({ render: () => h(component, { ...props, ...onEmit }) })
  app.component('RouterLink', RouterLinkStub)
  return renderToString(app)
}
