# Protected timeline review

`timeline-review.yml` is a manual, fail-closed control for existing Learning Radar and Market Radar drafts. It has no schedule and cannot create drafts, edit content, or bypass source verification. The requester cannot approve the same review.

The dispatch is bound to the exact `github.sha` selected when the request is created. After the protected `timeline-review` Environment is approved, the job requires that SHA to still be live `main`, checks the matching successful Release Controller run and domain deployment marker, and checks the same evidence immediately before and after the database mutation. If `main` changes while approval is pending, the review stops.

The reviewer supplies the draft ID, decision, and exact `updated_at` value. The workflow obtains the actual Environment approver from GitHub's workflow-run approvals API. The requesting actor and approving reviewer are stored separately. Database compare-and-swap rejects a stale version, a non-draft, or reuse of one workflow run with different inputs.

The protected Environment must expose only the secret name `TIMELINE_REVIEW_DATABASE_URL`. It points to the same Neon database as both Radar pipelines, but uses a least-privilege login with `USAGE` on `radar_system` and `EXECUTE` on `radar_system.review_timeline`. It must have no direct access to raw items, payloads, stories, events, or private audit tables. Migration 009 revokes function execution from `PUBLIC`; T7 must create the Environment and explicit database grant before enabling review.

Never put connection values, review-note contents, source payloads, prompts, or personal information in documentation, workflow summaries, issue comments, or logs. Notes are private audit data and are limited to 1,000 sanitized characters.
