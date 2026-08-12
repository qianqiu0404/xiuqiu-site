# Radar publication boundary

M0 makes the static daily brief and Neon API refer to one immutable publication snapshot. The snapshot is identified by a deterministic `snapshotId`, an `asOf` timestamp and a SHA-256 payload checksum.

## Public contract

- `origin` must be `research`.
- `publicationState` must be `published`.
- Public database rows must reference a published snapshot of the same Radar kind.
- API lists select one current `snapshotId`; they never merge rows from multiple snapshots.
- The generated Learn and Trade Radar datasets expose the same `snapshotId` and `asOf` in the page DOM.
- If an API dataset does not match the static snapshot, the static snapshot keeps display authority.

## QA isolation

`radar_qa` is a separate schema with no privileges for `public`. Migration `012_publication_content_boundary.sql` moves Preview and fixture product rows into `radar_qa.fixtures`, deletes them from product tables and replaces the public views with fixed-schema research-only queries.

Static publication rejects Preview fixtures and local xiuqiu PR, CI, deployment or Preview activity. The notification outboxes require the same published research snapshot and reject test kinds or fixture markers.

## Operational boundary

Run `npm run market-radar:migrate` only against the explicitly approved database branch. Run `npm run radar:publish-snapshots` to persist the validated static snapshots without enqueuing notifications. Production migration, deployment, domain changes and merging remain separately approval-gated.
