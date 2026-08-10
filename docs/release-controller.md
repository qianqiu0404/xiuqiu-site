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
6. A controller deployment marker and one exact-SHA worker smoke.
7. Completion of the controller run, which—together with the exact-SHA deployment marker and the operator-managed `MARKET_RADAR_ENABLED` kill switch—authorizes later schedules.

Any failed job prevents every downstream job from running. `vercel.json` disables every Git-triggered Vercel deployment, including pull-request Previews, so the controller is the only active production path.

Do not restore Preview deployments until both safeguards are verified: Vercel Dashboard automatic production-domain assignment (auto-assign) is disabled, and the controller has completed successfully for the same live `main` SHA. Restore Preview only with a reviewed, branch-scoped `deploymentEnabled` policy; never re-enable Git-triggered production deployments.

## Required repository settings

Create a protected GitHub Environment named `production-release` and restrict it to protected branches. The production jobs are the only jobs that reference its secrets.

- Environment secret: `VERCEL_TOKEN` (project-scoped, minimum practical lifetime and permissions).
- Environment variables: `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- Existing production secrets used inside Environment jobs: `MARKET_RADAR_DATABASE_URL`, `DEEPSEEK_API_KEY`, `SEC_USER_AGENT`.
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

Only a reviewed main SHA may be released. Set `MARKET_RADAR_ENABLED=true`, then dispatch the controller with `operation=release` and the complete live main SHA. The controller preflight fails closed unless that kill switch is enabled; the worker still cannot run until the exact-SHA deployment marker and successful controller run exist. Never run migrations or workers separately.

If migration, build, candidate verification, or smoke fails, the production alias remains on the prior deployment and the worker remains unauthorized. If promotion succeeds but a later check fails, stop the worker, use Vercel rollback to point the production domains to the previous READY deployment, and leave `watch_for_zh` and `invalidation_zh` in place. Set `MARKET_RADAR_ENABLED=false` to stop scheduled work; do not drop or rewrite the nullable columns.
