// Single source for the canonical origin and HTML/XML escaping, shared by the
// Vue app (src/), build scripts (scripts/) and serverless code (api/, lib/).
// Node 22 loads this file directly via type stripping, so keep it plain TS.

export const SITE_URL = 'https://xoqiu.cn'
export const githubProfileUrl = 'https://github.com/xoqiu09'
export const intelDescription = 'AI 与 Web3 工程简报和市场事件，支持按主题筛选、搜索与订阅。'

export function learningRadarCadence(latestDate?: string): string {
  const format = '每期含 2 条 AI、2 条 Web3 和 1 个专题。'
  return latestDate ? `${format}最近公开一期为 ${latestDate}。` : format
}

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
