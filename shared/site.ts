// Single source for the canonical origin and HTML/XML escaping, shared by the
// Vue app (src/), build scripts (scripts/) and serverless code (api/, lib/).
// Node 22 loads this file directly via type stripping, so keep it plain TS.

export const SITE_URL = 'https://xiuqiu-site.vercel.app'

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function escapeXml(value: string): string {
  return escapeHtml(value).replaceAll("'", '&apos;')
}
