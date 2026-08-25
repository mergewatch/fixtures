# E2E-84: #334 — Time-bounded insight rollup windows

Every disposition-counter increment (surface, dispute, verified, unverified,
silentDrop, agreement, resolve) also bumps a sparse per-UTC-day bucket
(`periodCounts`, keyed `YYYY-MM-DD`) on the `FindingDispositionRecord`,
atomically with the lifetime counter, on both backends. The nightly rollup then
derives every windowed number from **in-window activity**: a record first seen
inside the window contributes its lifetime counters (exact by definition); an
older record contributes only the day buckets overlapping the window.
`7d ≤ 30d ≤ 90d` holds by construction. Records written before #334 have no
buckets and contribute nothing to windows that predate their `firstSeen` — they
ramp up within one window-length of deploy instead of injecting lifetime
history. Shipped in #334 (PRs #341 + #343).

Seeding + rollup fixture, no fixture PR — trigger the rollup the same way as
**E2E-41** (Lambda invoke on SaaS / admin endpoint on self-hosted).

## Procedure

Pre-seed an installation with:

1. A "long-lived" record: `firstSeen` ~180 days back, `surfaceCount: 200`,
   `disputeCount: 30`, plus a `periodCounts` bucket for yesterday
   (`{ surface: 1 }`).
2. A "recent" record: `firstSeen` 2 days back, `surfaceCount: 3`,
   `disputeCount: 1`, no buckets needed.
3. A "legacy" record: `firstSeen` ~180 days back, large lifetime counters,
   **no** `periodCounts`.

Trigger the rollup manually, then read the three insight rows back.

## Expected outcomes

- [ ] 7d `totalFindingsSurfaced` = 4 (yesterday's bucket + the recent record) —
      NOT 200+
- [ ] 7d `totalDisputes` = 1 — the long-lived record's 30 lifetime disputes do
      not appear
- [ ] The legacy record contributes 0 to every window (honest ramp-up)
- [ ] `7d ≤ 30d ≤ 90d` for `totalFindingsSurfaced` and `totalDisputes`
- [ ] `perCategory` / `perSeverity` / `perRepo` / `topClusters` reflect windowed
      counts (spot-check the long-lived record's category bucket shows 1,
      not 200)
- [ ] New reviews after deploy write `periodCounts` buckets on both backends
      (inspect a row: Postgres `period_counts` jsonb / Dynamo
      `pc#<day>#<counter>` attributes)

## How to verify locally

`MANUAL_ONLY` — `grade-run.mjs` reads GitHub, and this fixture asserts on
DynamoDB. See [`e2e/MANUAL-VERIFICATION.md`](../../e2e/MANUAL-VERIFICATION.md)
for the session check and the command shapes.

- **Table** — `mergewatch-installation-fp-insights-dev` (the **dev** stage, never prod)
- **Key** — pk `installationId` · sk `window`
- **Look at** — `totalFindingsSurfaced` and `totalDisputes` per window, and `7d <= 30d <= 90d`

Record what you checked. A graded run reports this fixture as **NOT VERIFIED**,
and an unrecorded manual pass is indistinguishable from one that never
happened.
