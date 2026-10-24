const NAMES: Record<string, string> = {
  'openai.com': 'OpenAI', 'anthropic.com': 'Anthropic', 'eips.ethereum.org': 'Ethereum EIPs',
  'ethereum.org': 'Ethereum', 'docs.anthropic.com': 'Anthropic 文档',
}

export function sourceDisplayLabel(value: string, name?: string): string {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return '来源待确认'
    const domain = url.hostname.replace(/^www\./, '')
    const parts = url.pathname.split('/').filter(Boolean)
    const inferred = NAMES[domain] || (domain === 'github.com' && parts.length >= 2 ? `${parts[0]}/${parts[1]}` : domain)
    const title = name && !['原始来源', '打开原始来源'].includes(name) ? name : inferred
    return title === domain ? domain : `${title} · ${domain}`
  } catch { return name || '来源待确认' }
}
