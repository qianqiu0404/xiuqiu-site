# Production release controller

The controller is inert by default. It prevents a Vercel Git deployment or a manually dispatched Market Radar worker from racing ahead of the database schema that the same commit expects.

## Threat model

- A stale or abbreviated SHA must not be accepted as a production release.
- A failed migration, build, metadata check, or candidate smoke test must not move production domains or start the worker.
- Pull requests and forks must not receive production secrets.
- Scheduled and manual workers must not run for a main commit that the controller has not deployed.
- An application or worker rollback must preserve additive nullable database columns.

## Invariants

`release-controller.yml` accepts a full 40-character SHA that must equal the live `main` head. Every production job checks out and revalidates that SHA. The release runs under one non-canceling production concurrency group:

1. Preflight and the full repository build.
2. Production migration.
3. A Vercel production candidate built from the exact SHA with `--skip-domain`.
4. READY, project, target, SHA, ref, and alias-error validation plus candidate smoke tests.
5. Promotion of that verified candidate to the production domains.
6. Publish the latest reviewed Learning and Market research snapshots from this exact release without notification delivery. The legacy Market enqueue job name is retained for compatibility; its publication step selects each lane independently, rejects future published editions before promotion, ignores drafts, and fails closed on date/slug drift. Market notification delivery runs only when the dispatch explicitly sets `enqueue_market_notifications=true`. Learning stays skipped while its repository switch is off.
7. Only when the dispatch explicitly sets `run_market_worker=true`, run the AI-backed exact-SHA Market worker and create its dedicated successful deployment marker. Ordinary content releases default to no AI worker, no worker authorization marker and no Market notification. Existing worker kill switches and exact-SHA authorization checks remain in force.
8. An always-running, secret-free summary reports the result of every lane without changing or overriding any failed job.

Failures stop only their dependent lane: migration or deployment failures stop all production work. When `LEARNING_RADAR_ENABLED=false`, the Learning notification job is skipped and the terminal summary records that result without making an unimplemented lane look failed. Once Learning is enabled, a Learning notification failure remains red, never authorizes Learning delivery, and does not block a successfully verified Market lane. Market worker authorization never treats the aggregate summary as evidence. `vercel.json` disables every Git-triggered Vercel deployment, including pull-request Previews, so the controller is the only active production path.

Do not restore Preview deployments until both safeguards are verified: Vercel Dashboard automatic production-domain assignment (auto-assign) is disabled, and the controller has completed successfully for the same live `main` SHA. Restore Preview only with a reviewed, branch-scoped `deploymentEnabled` policy; never re-enable Git-triggered production deployments.

## Required repository settings

Create a protected GitHub Environment named `production-release` and restrict it to protected branches. The production jobs are the only jobs that reference its secrets.

- Environment secret: `VERCEL_TOKEN` (project-scoped, minimum practical lifetime and permissions).
- Environment variables: `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- Repository variable: `LEARNING_RADAR_ENABLED`. Keep it `false` until M4 is implemented and approved; the Learning job is then visibly skipped instead of turning an otherwise healthy release red.
- Learning notification Environment secret: `LEARNING_RADAR_DATABASE_URL`. It is never allowed to fall back to the Market database URL. Once `LEARNING_RADAR_ENABLED=true`, a missing or invalid secret fails only the Learning lane.
- Market Environment secrets: `MARKET_RADAR_DATABASE_URL`, `DEEPSEEK_API_KEY`, `SEC_USER_AGENT`.
- Repository variable: `MARKET_RADAR_ENABLED`. Keep it `false` for R0. Set it to `true` immediately before an approved controller release; the exact-SHA deployment marker still prevents worker execution until the controller completes. Set it back to `false` to stop schedules.

Protect `main` with pull requests and the existing `verify` and `secrets` Site CI checks. Do not add a required check name that has not already succeeded in this repository.

The controller uses the Environment secret only through the shell variable `"$VERCEL_TOKEN"`. Before it reads production configuration, it runs non-printing account and project access checks. A token that cannot inspect the configured project, build the candidate, or promote it must fail the chain without exposing the credential.

## Dry-run

Use dry-run after the controller is merged. It requests no production Environment and no production secret:

```sh
gh workflow run release-controller.yml --ref main \
  -f operation=dry-run \
  -f release_sha="$(git rev-parse origin/main)"
```

The preflight summary records the exact SHA, DAG audit, and permission audit. All production jobs must be skipped. The worker workflow also defaults to `dry-run`; it reports whether the current main SHA has all authorization signals without entering the production Environment.

## Production release and rollback

Only a reviewed main SHA may be released. The current preflight still requires the existing `MARKET_RADAR_ENABLED=true` channel permission. Dispatch the controller with `operation=release` and the complete live main SHA. For a content-only release, leave both `enqueue_market_notifications` and `run_market_worker` at their default `false`; validated static research snapshots are still published. Neither optional action may be inferred from an ordinary content update request. The controller preflight fails closed unless that kill switch is enabled; the worker still cannot run until both the exact-SHA deployed marker and the dedicated successful Market-lane marker exist. Never run migrations or workers separately.

If migration, build, candidate verification, or smoke fails, the production alias remains on the prior deployment and the worker remains unauthorized. If promotion succeeds but a later check fails, stop the worker, use Vercel rollback to point the production domains to the previous READY deployment, and leave `watch_for_zh` and `invalidation_zh` in place. Set `MARKET_RADAR_ENABLED=false` to stop scheduled work; do not drop or rewrite the nullable columns.

## Content restoration and runtime status

The static research publication pointer and runtime event rows are separate facts. Publishing a reviewed Markdown snapshot does not fabricate runtime events or digests, restart a collector, or claim the AI worker is healthy. Public readers retain static snapshot authority when runtime data is absent or mismatched. A content-only release intentionally leaves runtime schedules in dry-run until separately authorized; the new SHA receives no worker marker.

The old `enqueue_market_radar_notifications` job name remains unchanged because other workflows audit it. The release summary reports its snapshot publication result separately from whether notification delivery was requested. A skipped optional worker is not a successful worker smoke test.

The preflight resolves the latest reviewed research date for the exact checkout and passes that Market date to the promoted-page verifier. A release that crosses midnight still verifies the selected page and pack; it cannot silently treat an absent new-day file as a successful verification.
