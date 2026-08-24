# xiuqiu-site

[Live site](https://xiuqiu-site.vercel.app)

xiuqiu-site 是 Qiu Market、Wallet Infrastructure 学习方向与 AI Engineering 交付证据的公开入口。当前只把 Qiu Market 作为产品呈现；Wallet Infrastructure 保持在学习、私有基线审计与最小失败证据阶段，不把历史材料或模拟实验包装成当前实现、生产钱包或真实资金经验。

## Current frame

- **Qiu Market**：当前可展示的 Web3 产品，使用虚拟资金验证市场事实、订单状态、账务与恢复边界。
- **Wallet Infrastructure**：当前钱包后端学习与工程证据方向；公开页面只显示通过发布门禁的方向、证据等级和限制。
- **AI Engineering**：记录 AI 参与需求、实现、审查与测试的过程，同时保留人工判断和最终放行边界。

历史公开模拟与交付记录仍作为可追溯证据保留，例如 [Wallet Reliability Lab](https://wallet-reliability-lab.vercel.app) 和 [Wallet Domain Engine](https://github.com/qianqiu0404/web3-wallet-engineer-lab)；它们不定义当前产品优先级。

Production releases follow the exact-SHA, DB-first process in [`docs/release-controller.md`](docs/release-controller.md).

Vercel Git deployments, including pull-request Previews, are disabled while the release controller is the sole production path. Preview may be restored only after Dashboard auto-assign is confirmed off and the controller has succeeded for the same live `main` SHA; see the release guide for the guarded, branch-scoped policy.

公开仓库不包含私有钱包服务的源码、地址或配置。私有工程只展示经过发布门禁的脱敏边界和当前限制。

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
- `content/market-radar/*.md`: reviewed static Trade Radar snapshots, isolated from the Learn Radar content model
- `market-radar/`: optional shadow engine with isolated migrations, registration-free collectors, scoring, crypto reaction tracking and digest/outbox workers
- `api/market-radar/`: shadow-engine read/feedback endpoints plus token-protected Hermes claim/ack endpoints
- `src/pages/MarketRadar*.vue`: independently lazy-loaded static Trade Radar overview and dated snapshot views; `/radar` remains the separate Learn Radar

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

Configure the public assistant in Vercel. The Market Radar database and dispatcher values are only required when the optional shadow engine and Hermes outbox are enabled:

```env
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
MARKET_RADAR_DATABASE_URL=
MARKET_RADAR_DISPATCH_TOKEN=
```

Configure the optional scheduled Market Radar shadow worker in GitHub Actions secrets. The database URL must be the same Neon pooled connection string used by Vercel:

```env
MARKET_RADAR_DATABASE_URL=
DEEPSEEK_API_KEY=
SEC_USER_AGENT=
```

Keep `MARKET_RADAR_ENABLED` set to `false` until migrations and the manual ingestion smoke test pass. Set it to `true` only for an approved release or worker lane. Scheduled workers may request the protected production environment only when `MARKET_RADAR_AUTOMATION_READY=true`; otherwise schedules remain dry-run. Hermes stores `MARKET_RADAR_DISPATCH_TOKEN` and `WEIXIN_HOME_CHANNEL` only in its local secret environment; Weixin credentials never belong in Vercel or GitHub.

The right-side assistant is part of the public site. It uses the reviewed public knowledge graph, sends visitor questions to the DeepSeek API, and fails closed when the provider key is unavailable. The in-memory limiter is a best-effort per-instance guard, not a persistent production quota. Never commit a real API key. `.env.example` contains names and safe defaults only.

xiuqiu AI receives only the most relevant records from the generated public knowledge layer for each question. It does not read private repositories or Obsidian source notes, and operational logs record request timing and response sizes without recording the user's question text.

### Market Radar boundary

`/market-radar` is a static, source-backed research snapshot, not an account or execution system. It never connects to positions, wallets or broker accounts and cannot place orders. Its public page is generated from reviewed `content/market-radar/` files and does not depend on the database or an upstream provider at request time.

Daily authoring, schema v2 research-question rules, deterministic strong-model packs, and publication gates are documented in [`docs/market-radar-researchops.md`](docs/market-radar-researchops.md).

The optional GitHub Actions shadow worker runs independently from the static website build, writes to the dedicated Neon `market_radar` schema, and prepares auditable Hermes outbox messages. Its read API is backed only by a reviewed SQL view; raw provider payloads, model prompts, credentials and private notes are not selected by those endpoints. Shadow-engine failure cannot erase or replace the reviewed static snapshot.

The worker is disabled until the GitHub variable `MARKET_RADAR_ENABLED=true` and all required secrets are configured. Run `npm run market-radar:migrate` once before enabling ingestion. Raw provider payloads are purged after 14 days while event source links remain auditable; events, reactions, digests, feedback and trial metrics expire after one year.

Event verification boundaries use the additive v2 contract introduced by `003_event_verification_boundaries.sql`. Roll it out in this order: apply the database migration, deploy the null-tolerant API and UI, then enable the v2 worker. If a rollback is required, stop or revert the worker and application first; keep the nullable `watch_for_zh` and `invalidation_zh` columns in place so already written v2 research boundaries are not destroyed. Legacy rows remain null and must not be inferred from judgments, reactions or digest text.

The initial worker uses only registration-free public sources: official crypto project releases from GitHub, SEC company filings and press releases, Federal Reserve RSS, and Binance public spot candles for supported crypto reaction tracking. US-equity reactions and assets without a Binance public pair remain explicitly `pending`; the system does not substitute unlicensed or synthetic prices. Hermes never calls upstream providers or stores their credentials: it only claims prepared messages from the token-protected Market Radar outbox.

Public freshness is based on when an event occurred, not when a provider backlog was collected. Events older than 72 hours fail the publication gate, and the public SQL view keeps only the latest seven days. Daily and premarket digests lead with a grouped conclusion, list at most three specially watched assets with direction, horizon, confirmation and invalidation, and explicitly report “暂无” when no asset clears the threshold instead of forcing a directional call.

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
