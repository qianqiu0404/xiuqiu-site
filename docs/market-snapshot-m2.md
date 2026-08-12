# M2 unified market snapshot

M2 adds a trustworthy hourly market “camera”; it does not predict direction, place orders, or publish trading advice. Qiu Market is the only producer. It signs one canonical 21-asset snapshot, and xiuqiu-site stores that exact snapshot as an immutable Neon record.

## M2-A outcome

- Qiu Market captures public Binance quotes for `BTC-USDT`, `ETH-USDT`, and `SOL-USDT`.
- The other 18 fixed assets remain present as explicit `unavailable` coverage records.
- A single HMAC-authenticated request atomically stores snapshot, quote, coverage, replay nonce, and current pointer.
- `/api/market-radar/market-status` exposes coverage, market state, mode, and snapshot identity only.
- `/private/market` exposes only quotes whose stored scope is `private`, after GitHub OAuth authentication for numeric user ID `155644811`.
- The Preview OAuth callback is pinned to `https://xiuqiu-site-m2-preview.vercel.app/api/private-market/auth/github/callback`.

M2-A is Preview-only. It does not add a Production cron, modify Production, send notifications, or depend on Qiu Market PR #15.

## Data flow

```text
Binance public market API
  -> Qiu Market canonical MarketSnapshotV1
  -> SHA-256 snapshotId/checksum
  -> HMAC request with timestamp + nonce
  -> xiuqiu-site M2 API
  -> one Neon transaction
       snapshots + quotes + coverage + current pointer
  -> public coverage DTO / authenticated private DTO
```

The application never fills a missing asset with an unrelated provider or an old value. Provider failures are represented as `stale` or `unavailable`, with the real observation time and delay retained.

## Decisions and alternatives

- Store decimal prices as strings. JavaScript floating point was rejected because it can change exact provider values.
- Derive identity from canonical JSON. Random IDs were rejected because they cannot detect payload drift.
- Keep one producer. xiuqiu-site fetching providers itself was rejected because two producers can disagree about “current”.
- Use one catch-all M2 function with exact pathname dispatch. Six independent functions were rejected because they would exceed the current Preview function budget.
- Persist only a session token hash. Persisting a GitHub access token was rejected; the OAuth token is discarded immediately after public identity verification.
- Keep the public SQL view price-free. Filtering prices only in Vue was rejected because APIs and logs would still leak them.

## Failure and recovery

| Failure | Result | Recovery |
| --- | --- | --- |
| Binance timeout or malformed response | A complete 21-item snapshot records affected assets as unavailable; no substitute quote | Retry at the next Preview capture |
| Invalid HMAC, expired timestamp, or reused nonce | Request rejected before current pointer changes | Correct producer clock/key and submit a fresh nonce |
| Snapshot ID/checksum conflict | Entire transaction rejected | Investigate canonicalization; never overwrite the old snapshot |
| Database write failure | Transaction rolls back, preserving the previous current pointer | Restore Preview DB availability and resubmit the same immutable payload with a fresh nonce |
| OAuth state, PKCE, callback, or account mismatch | No private session created | Restart login from the fixed Preview alias |
| Provider or database unavailable | UI says unavailable; it does not replay a cached price as current | Wait for a verified new snapshot |

Recovery is additive. Do not delete or rewrite an accepted snapshot to make a test pass.

## Operational cost and boundaries

M2-A uses the Binance public endpoint and existing Preview infrastructure. It creates no paid provider dependency. A private page adds one authenticated read per refresh. Raw price payloads are not exposed by the public DTO or included in public static assets.

The migration must only run on the authorized Neon Preview branch. OAuth secrets, the flow-encryption secret, and the HMAC key must only be configured in the fixed Vercel Preview environment after separate approval.

## Entry points

1. `market-radar/migrations/013_market_snapshots.sql` — atomic storage, replay guard, sessions, and public view.
2. `lib/market-snapshot/contract.ts` — canonical 21-asset consumer contract.
3. `api/[...m2].ts` — exact-path ingest, public status, and private authentication/read API.
4. `src/pages/PrivateMarketPage.vue` — authenticated private market view.
5. `src/pages/MarketRadarPage.vue` — compact public coverage status.

## Terms

- **snapshotId**: deterministic identity derived from the canonical payload checksum.
- **asOf**: the coordinated observation time represented by a snapshot.
- **coverage**: exactly one status record for each of the 21 fixed assets.
- **internal_non_display**: a quote allowed for analysis but forbidden from all display DTOs.
- **current pointer**: the one-row reference to the newest accepted snapshot; never updated partially.
- **PKCE**: OAuth code-verifier protection that binds the callback to the login flow.

## 60-second explanation

Every hour Qiu Market produces one signed photograph of the same 21 assets. Missing data remains visible as missing. xiuqiu-site verifies the signature and writes the photograph in one transaction, so all readers see the same `snapshotId` and `asOf`. The public Trade Radar receives only coverage and delay state. The private page receives only explicitly displayable quotes after a pinned GitHub identity check. If any verification fails, the old current pointer remains visible and the UI says the new data is unavailable rather than pretending it is live.

## Review questions

1. Does every accepted snapshot contain exactly the fixed 21 coverage records?
2. Can any `internal_non_display` or other price reach the public DTO, HTML, JavaScript, or logs?
3. Does a failure leave the previous current pointer intact?
4. Is GitHub OAuth restricted to the fixed Preview callback and numeric ID?
5. Are Preview runner, secrets, alias, database migration, and Production still separate approvals?

## Required before M2-B

M2-A intentionally has one live quote per available Binance asset, so its five-minute freshness rule is narrow. Before adding Twelve Data analysis quotes and Alpha Vantage display EOD quotes, evolve the shared contract to use per-market, per-provider, and per-role freshness policies. One asset must be able to carry both an hourly `analysis/internal_non_display` quote and a `display/private` EOD quote without applying the live threshold to the closed-market EOD value. Top-level partial status must derive from coverage, not quote count. This is a blocking M2-B contract change, not evidence that M2-A supports dual-role or EOD data today.
