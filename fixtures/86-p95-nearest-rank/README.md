# E2E-86: #336 — p95 duration: nearest-rank + minimum sample

The analytics duration card computes p95 as the nearest-rank element
(`⌈n × 0.95⌉`, clamped to a valid index) over completed reviews' durations. The
old `floor(n × 0.95)` index returned the **maximum** for every n ≤ 20 — the
slowest review wearing a percentile label, worst exactly when a new instance has
little data. Below `MIN_P95_SAMPLE_SIZE` (20) completed reviews, `p95Ms` is
`null` and the UI shows "—" with a "needs at least 20 completed reviews"
tooltip and omits the P95 chart bar; Average and Completed still render.
Shipped in #336 (PR #346).

Dashboard-inspection fixture, no fixture PR.

## Procedure

1. On an instance with < 20 completed reviews (or a date filter narrowing to
   that), open `/dashboard/analytics` → Activity tab: the P95 stat shows "—"
   (hover for the tooltip), the duration chart has only the Average bar.
2. With ≥ 20 completed reviews: P95 renders a number that is **not** the slowest
   review unless the distribution genuinely puts it there (seed 20 distinct
   durations: p95 must equal the second-highest, rank 19).

## Expected outcomes

- [ ] n ≤ 19 → "—" + tooltip, no P95 bar, no fabricated number
- [ ] n = 20 with distinct durations → p95 = second-highest value (not the
      maximum)
- [ ] Average / Completed unaffected in both states

## How to verify locally

`MANUAL_ONLY` — `grade-run.mjs` reads GitHub, and this fixture asserts on
DynamoDB. See [`e2e/MANUAL-VERIFICATION.md`](../../e2e/MANUAL-VERIFICATION.md)
for the session check and the command shapes.

- **Table** — `mergewatch-installation-fp-insights-dev` (the **dev** stage, never prod)
- **Key** — pk `installationId` · sk `window`
- **Look at** — the p95 value against the nearest-rank definition

Record what you checked. A graded run reports this fixture as **NOT VERIFIED**,
and an unrecorded manual pass is indistinguishable from one that never
happened.
