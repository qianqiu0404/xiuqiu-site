# Public Evidence Contract v1

This contract keeps the public site focused without discarding earlier engineering evidence. Project priority and Claim readiness are separate facts.

## Status axes

`publicRole` controls where a project appears:

- `current-product`: the one product currently presented as a product.
- `current-direction`: the one active learning and evidence-building direction.
- `historical-evidence`: retained engineering evidence that does not define current priority.

`claimState` controls what the public record may claim:

- `locked`: direction or evidence may be described, but the Claim has not passed its public gate.
- `evidence-ready`: reviewed evidence supports the bounded current Claim.
- `publishable`: the historical artifact has a public, independently inspectable evidence entry.

The axes are deliberately orthogonal. A historical artifact may be `publishable`; it still remains historical.

## v1 mapping

| Project | Public role | Claim state | Activity |
| --- | --- | --- | --- |
| Qiu Market | `current-product` | `evidence-ready` | `active` |
| Wallet Infrastructure | `current-direction` | `locked` | `active` |
| wallet-core | `historical-evidence` | `publishable` | `paused` |
| Wallet Reliability Lab | `historical-evidence` | `publishable` | `paused` |
| Web3 Wallet Domain Engine | `historical-evidence` | `publishable` | `paused` |
| risk-server | `historical-evidence` | `locked` | `paused` |
| StableFlow | `historical-evidence` | `locked` | `paused` |
| TSS / MPC | `historical-evidence` | `locked` | `paused` |

## Source contract

`content/projects/*.md` is the reviewed public release artifact used by local and hosted builds. It is complete without Obsidian and must carry every required public field. When a canonical Obsidian identity differs from the public site slug, the artifact declares `sourceProjectId` (currently `wallet-infra-mainline` and `qiu-market` for the two current roles).

`content/obsidian-public/projects.json` is an optional overlay with source identifier `explicit-publish-frontmatter/v1`. The exporter scans only the allowlisted Vault roots `20-项目做证据/` (projects) and `50-复盘看变化/每周/` (reviewed weeklies), rejects missing roots and symlink escapes, and then accepts only canonical notes that explicitly set `publish: true`. It never reads other Vault areas and never exports note bodies or source paths. An empty `projects` array means no canonical note currently requests a public override and is a valid, reproducible state.

The generator applies overlays by `siteSlug` and binds every `projectId` to the reviewed artifact's `sourceProjectId` (falling back to the slug only when the identities are intentionally the same). No independent ID table exists. Missing overlays leave reviewed release artifacts unchanged. Both the snapshot and each overlay record use exact-key allowlists containing only fields the generator consumes: extra fields, incomplete records, unknown or duplicated slugs, invalid UTC `generatedAt`, mismatched `projectId`, and invalid shared enums all fail closed. Public role, Claim state and repository visibility must match the reviewed artifact; an overlay cannot promote or expose a repository. The exporter and generator share the same reviewed identity bindings and stage, portfolio, activity and visibility enums, so an accepted export can be regenerated without changing meaning.

Every accepted scalar must be trimmed, `publicEvidence` must be non-empty, and all exported text passes the shared public-safety check. Private/local paths, credential-shaped values and other non-public text are rejected before generation. These rules prevent a committed, no-longer-regenerable snapshot—or an apparently harmless extra field—from silently becoming project authority or leaking private context.

## Release review

Before a PR is ready for merge:

1. Verify the v1 mapping and ensure the Atlas has one current product, one current direction and six historical entries.
2. Check that historical detail pages visibly state they do not define current priority.
3. Run the content contract tests, project generator, homepage tests, type checks and public safety checks.
4. Review generated data together with its Markdown source and optional overlay.

This contract does not authorize merge or production release. Those remain separate exact-SHA decisions.
