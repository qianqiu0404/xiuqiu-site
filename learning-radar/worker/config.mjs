export const LEARNING_CATEGORIES = ['ai', 'web3_wallet', 'engineering_tools', 'reading']

export const LEARNING_SOURCES = [
  {
    key: 'openai_node_releases', kind: 'github_releases', category: 'ai', official: true,
    repository: 'openai/openai-node', sourceName: 'OpenAI SDK Releases',
  },
  {
    key: 'anthropic_sdk_releases', kind: 'github_releases', category: 'ai', official: true,
    repository: 'anthropics/anthropic-sdk-typescript', sourceName: 'Anthropic SDK Releases',
  },
  {
    key: 'metamask_releases', kind: 'github_releases', category: 'web3_wallet', official: true,
    repository: 'MetaMask/metamask-extension', sourceName: 'MetaMask Releases',
  },
  {
    key: 'walletconnect_releases', kind: 'github_releases', category: 'web3_wallet', official: true,
    repository: 'WalletConnect/walletconnect-monorepo', sourceName: 'WalletConnect Releases',
  },
  {
    key: 'vite_releases', kind: 'github_releases', category: 'engineering_tools', official: true,
    repository: 'vitejs/vite', sourceName: 'Vite Releases',
  },
  {
    key: 'playwright_releases', kind: 'github_releases', category: 'engineering_tools', official: true,
    repository: 'microsoft/playwright', sourceName: 'Playwright Releases',
  },
  {
    key: 'github_changelog', kind: 'rss', category: 'reading', official: true,
    feedUrl: 'https://github.blog/changelog/feed/', allowedHosts: ['github.blog'], sourceName: 'GitHub Changelog',
  },
  {
    key: 'postgresql_news', kind: 'rss', category: 'reading', official: true,
    feedUrl: 'https://www.postgresql.org/news.rss', allowedHosts: ['www.postgresql.org'], sourceName: 'PostgreSQL News',
  },
]

export const AIHOT_SOURCE = {
  key: 'aihot_discovery', kind: 'aihot', category: 'ai', official: false,
  endpoint: 'https://aihot.virxact.com/api/v1/items?mode=selected&window=7d&by=timeline&limit=20',
  sourceName: 'AIHOT Discovery',
}

export const ALL_LEARNING_SOURCES = [...LEARNING_SOURCES, AIHOT_SOURCE]

export const SOURCE_BY_KEY = new Map(ALL_LEARNING_SOURCES.map(source => [source.key, source]))
