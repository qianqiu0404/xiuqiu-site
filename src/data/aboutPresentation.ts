interface AboutEvidence { slug: string; title: string; summary: string; verifiedAt: string }
interface AboutDelivery { slug: string; title: string; summary: string; date: string }

export const aboutReadingLinks = [
  { to: '/', title: '情报流', description: '追踪 AI、Web3 与市场的新资料。' },
  { to: '/radar', title: '学习雷达', description: '围绕原始来源，记录机制、影响与待验证问题。' },
  { to: '/articles', title: '工程笔记', description: '把项目里的问题、尝试和复盘留成记录。' },
  { to: '/engineering/evidence', title: '工程证据', description: '核对公开演示、验证范围与失败边界。' },
] as const

export function aboutEvidenceRows(evidence: readonly AboutEvidence[], deliveries: readonly AboutDelivery[]) {
  const wallet = evidence.find(record => record.slug === 'wallet-lab-demo')
  const market = evidence.find(record => record.slug === 'qiu-market-release-artifact')
  const delivery = deliveries.find(record => record.slug === 'wallet-reliability-lab-v1')
  return [
    ...(market ? [{ id: 'market', label: 'Qiu Market · 工程证据', date: market.verifiedAt, title: market.title, summary: market.summary, to: '/projects/s78-market-services' }] : []),
    ...(wallet ? [{ id: 'wallet', label: '钱包 · 历史模拟证据', date: wallet.verifiedAt, title: wallet.title, summary: `历史公开模拟证据：${wallet.summary}`, to: '/projects/wallet-reliability-lab' }] : []),
    ...(delivery ? [{ id: 'ai', label: 'AI 工程 · 历史交付', date: delivery.date, title: delivery.title, summary: delivery.summary, to: `/ai/deliveries/${delivery.slug}` }] : []),
  ]
}
