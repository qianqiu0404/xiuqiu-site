# xiuqiu-site

[Live site](https://xiuqiu-site.vercel.app) · [Wallet Reliability Lab](https://wallet-reliability-lab.vercel.app) · [Wallet Domain Engine](https://github.com/qianqiu0404/web3-wallet-engineer-lab)

项目驱动的 Web3 钱包后端公开工程档案。网站把项目、文章、异常恢复手册、测试证据和 AI 协作交付连接成一条可复核路径。

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
- `content/failure-cases/*.md`: structured wallet failure recovery playbook
- `content/evidence/*.md`: reproducible, public-safe engineering evidence
- `content/deliveries/*.md`: AI-assisted delivery records and human decisions
- `src/data/generated*.ts`: generated typed data; do not edit by hand
- `src/data/siteKnowledge.ts`: unified project/article/evidence knowledge graph
- `api/chat.ts`: Vercel serverless DeepSeek proxy; the browser never receives the API key

## Commands

```bash
npm ci
npm run dev
npm run test:radar
npm run build
npm run check:knowledge
npm run check:public
```

`npm run build` regenerates public content, validates knowledge links, type-checks the serverless API and Vue app, builds Vite, and generates static metadata pages.

## Environment

Configure only in Vercel:

```env
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
```

Never commit a real API key. `.env.example` contains names only.

## Content workflow

1. Edit the source file under `content/`.
2. Mark public learning records explicitly with `publish: true` and `kind: learning-log`.
3. Public projects must provide a verified, accessible `repositoryUrl`; private projects must not expose one.
4. Run `npm run build` and commit the generated TypeScript and sitemap changes with the source content.
5. Keep verified implementation, partial evidence, design targets, and known limits visibly separate.

The local Obsidian sync command reads only explicitly marked public notes. Hosted builds consume committed repository content and never access a local vault.

## Public safety

- DeepSeek credentials exist only as Vercel environment variables.
- CI scans the full Git history for secrets and checks generated public data.
- Local absolute paths, credential-shaped values and private Git remote URLs fail `npm run check:public`.
- Public evidence uses accessible HTTPS links or a `private-summary` without a URL.

## License

Source code is MIT licensed. Original writing and content under `content/` is licensed under CC BY-NC-SA 4.0 unless a file states otherwise. See [NOTICE.md](NOTICE.md) and [content/LICENSE.md](content/LICENSE.md).
