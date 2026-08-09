# xiuqiu-site

[Live site](https://xiuqiu-site.vercel.app) · [Wallet Reliability Lab](https://wallet-reliability-lab.vercel.app) · [Wallet Domain Engine](https://github.com/qianqiu0404/web3-wallet-engineer-lab)

面向工程合作者的 Web3 钱包后端公开工程档案。网站用分层项目图谱区分旗舰系统、可验证作品和工程探索，并把行业雷达、异常恢复、测试证据和 AI 协作交付连接成一条可复核路径。

## Three-repository portfolio

```text
xiuqiu-site                     个人技术品牌、文章与证据总入口
        │
        ├── wallet-reliability-lab      正式交互实验台
        │
        └── web3-wallet-engineer-lab    Go 领域引擎与资金不变量
```

公开仓库不包含四个私有钱包服务的源码、地址或配置。私有工程只展示脱敏后的边界、测试名称和当前限制。

## Architecture

- `content/articles/*.md`: article sources and metadata
- `content/projects/*.md`: project stage, evidence, target and boundaries
- `content/obsidian-public/projects.json`: allowlisted project fields exported from Obsidian; no note bodies or source paths
- `content/obsidian-public/radar-weeklies.json`: human-reviewed weekly convergence exported from Obsidian public fields
- `content/failure-cases/*.md`: structured wallet failure recovery playbook
- `content/evidence/*.md`: reproducible, public-safe engineering evidence
- `content/deliveries/*.md`: AI-assisted delivery records and human decisions
- `src/data/generated*.ts`: generated typed metadata; article bodies are loaded from Markdown only when their route opens
- `src/data/siteKnowledge.ts`: unified project/article/evidence knowledge graph
- `api/chat.ts`: serverless chat proxy for xiuqiu AI, with scoped public-context retrieval, request limits, upstream timeout, and content-free operational logs
- `market-radar/`: isolated trading-event migrations, collectors, deterministic scoring, reaction tracking and digest/outbox workers
- `api/market-radar/`: public read/feedback endpoints plus token-protected Hermes claim/ack endpoints
- `src/pages/MarketRadar*.vue`: independently lazy-loaded Trade Radar list and event detail views; `/radar` remains the static Learn Radar

## Commands

```bash
npm ci
npm run dev
npm run test:radar
npm run test:market-radar
npm run typecheck:api
npm run sync:obsidian-public
npm run build
npm run check:knowledge
npm run check:public
```

`npm run build` regenerates public content, validates knowledge links, type-checks the serverless API and Vue app, builds Vite, and generates static metadata pages.

## Environment

Configure the website runtime in Vercel for both Production and Preview:

```env
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
MARKET_RADAR_DATABASE_URL=
MARKET_RADAR_DISPATCH_TOKEN=
```

Configure the scheduled Market Radar worker in GitHub Actions secrets. The database URL must be the same Neon pooled connection string used by Vercel:

```env
MARKET_RADAR_DATABASE_URL=
DEEPSEEK_API_KEY=
SEC_USER_AGENT=
```

Keep `MARKET_RADAR_ENABLED` as a GitHub Actions variable set to `false` until migrations and the manual ingestion smoke test pass. Hermes stores `MARKET_RADAR_DISPATCH_TOKEN` and `WEIXIN_HOME_CHANNEL` only in its local secret environment; Weixin credentials never belong in Vercel or GitHub.

The right-side assistant is part of the public site. It uses the reviewed public knowledge graph, sends visitor questions to the DeepSeek API, and fails closed when the provider key is unavailable. The in-memory limiter is a best-effort per-instance guard, not a persistent production quota. Never commit a real API key. `.env.example` contains names and safe defaults only.

xiuqiu AI receives only the most relevant records from the generated public knowledge layer for each question. It does not read private repositories or Obsidian source notes, and operational logs record request timing and response sizes without recording the user's question text.

### Market Radar boundary

`/market-radar` is a read-only event radar, not an account or execution system. It never connects to positions, wallets or broker accounts and cannot place orders. The GitHub Actions worker runs independently from the website build, writes to the dedicated Neon `market_radar` schema, and fails closed when a provider or AI response is unavailable. The public API is backed only by a reviewed SQL view; raw provider payloads, model prompts, credentials and private notes are not selected by public endpoints.

The worker is disabled until the GitHub variable `MARKET_RADAR_ENABLED=true` and all required secrets are configured. Run `npm run market-radar:migrate` once before enabling ingestion. Raw provider payloads are purged after 14 days while event source links remain auditable; events, reactions, digests, feedback and trial metrics expire after one year.

The initial worker uses only registration-free public sources: official crypto project releases from GitHub, SEC company filings and press releases, Federal Reserve RSS, and Binance public spot candles for supported crypto reaction tracking. US-equity reactions and assets without a Binance public pair remain explicitly `pending`; the system does not substitute unlicensed or synthetic prices. Hermes never calls upstream providers or stores their credentials: it only claims prepared messages from the token-protected Market Radar outbox.

## Content workflow

1. Maintain project status and public-safe summaries in the canonical Obsidian project home.
2. Mark publication candidates explicitly with `publish: true`; the default is private.
3. Run `OBSIDIAN_VAULT_PATH=<vault> npm run sync:obsidian-public`. The exporter reads only allowlisted frontmatter fields and denies private paths.
4. Edit site-only architecture details under `content/`; public projects must provide an accessible `repositoryUrl`, while private projects must not expose one.
5. Run `npm run build` and commit the reviewed snapshot, source content, generated TypeScript and sitemap together.
6. Keep verified implementation, partial evidence, design targets, and known limits visibly separate.

The local Obsidian sync command reads only explicitly marked public notes. Hosted builds consume committed repository content and never access a local vault.

## Public safety

- AI provider credentials exist only as Vercel environment variables; the browser never receives the provider key.
- CI scans the full Git history for secrets and checks generated public data.
- Local absolute paths, credential-shaped values and private Git remote URLs fail `npm run check:public`.
- Public evidence uses accessible HTTPS links or a `private-summary` without a URL.

## License

Source code is MIT licensed. Original writing and content under `content/` is licensed under CC BY-NC-SA 4.0 unless a file states otherwise. See [NOTICE.md](NOTICE.md) and [content/LICENSE.md](content/LICENSE.md).
