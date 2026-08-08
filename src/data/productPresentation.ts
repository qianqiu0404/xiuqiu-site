import { walletLabUrl } from './homePresentation.ts'

export type ProductTheme = 'wallet' | 'market'

export interface ProductPresentation {
  slug: 'wallet-launchpad' | 's78-market-services'
  theme: ProductTheme
  index: string
  label: string
  shortName: string
  heroLines: readonly [string, string]
  promise: string
  publicAction: {
    label: string
    href: string
    boundary: string
    role: 'product' | 'companion'
  }
  proofAction: {
    label: string
    to: string
  }
  flowLabel: string
  proofTitle: string
}

export const qiuMarketUrl = 'https://qiu-market.vercel.app'

export const productPresentations: readonly ProductPresentation[] = [
  {
    slug: 'wallet-launchpad',
    theme: 'wallet',
    index: '01',
    label: 'Wallet Platform',
    shortName: 'Wallet Launchpad',
    heroLines: ['钱包控制平面', '资金事实可操作'],
    promise: '让团队在同一个入口理解链与资产 readiness、资金状态、签名健康和异常恢复，而不把浏览器带进私钥与基础设施边界。',
    publicAction: {
      label: '运行配套实验（simulation-only）',
      href: walletLabUrl,
      boundary: '这是独立的 simulation-only 配套实验，不是 Wallet Launchpad 或其受保护 Preview。',
      role: 'companion',
    },
    proofAction: {
      label: '检查 Wallet Launchpad 证据',
      to: '/engineering/evidence#wallet-launchpad-no-funds-acceptance',
    },
    flowLabel: 'A withdrawal through explicit trust boundaries',
    proofTitle: '从测试网闭环与无资金门禁，说明系统已经走到哪里。',
  },
  {
    slug: 's78-market-services',
    theme: 'market',
    index: '02',
    label: 'Market Server',
    shortName: 'Qiu Market',
    heroLines: ['可信市场事实', '交易状态可恢复'],
    promise: '上游来源异常时不制造假价格；提交结果未知或服务重启后，订单、余额和事件仍沿持久化事实确定性恢复。',
    publicAction: {
      label: '打开 Qiu Market',
      href: qiuMarketUrl,
      boundary: '公开产品使用虚拟资金，不连接充值、提现、私钥或实盘资产。',
      role: 'product',
    },
    proofAction: {
      label: '检查 Market 证据',
      to: '/engineering/evidence',
    },
    flowLabel: 'Sources become a recoverable market truth layer',
    proofTitle: '用同一 release artifact 连接数据来源、交易状态与恢复证据。',
  },
] as const

export const productPresentationBySlug = new Map(
  productPresentations.map(item => [item.slug, item]),
)
