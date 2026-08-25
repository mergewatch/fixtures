# E2E-56: TTM — cycle-time rollup (time-to-merge, stage 2)

The hourly rollup pages each installation's `PRLifecycleRecord` rows and attaches a `cycleTime` block to every window's `InstallationFPInsight`: merge counts (merged / reviewed / unreviewed / closed-unmerged / open) plus **median/p75/p90** percentiles (in hours) for time-to-merge, time-from-first-review-to-merge, and round-trips — segmented reviewed vs unreviewed. Percentiles use R-7 linear interpolation; an empty sample yields `null`, not `0`. Back-compat: when the PR-lifecycle store isn't wired, `cycleTime` is omitted and the rollup is unchanged.

No new branch or PR — this is a seed-and-rollup fixture. Shipped in #198.

## Procedure

Branch: `fixture/56-ttm-rollup`.

### Pre-seed

Pre-seed an installation with ~15 lifecycle rows: a mix of reviewed-merged, unreviewed-merged, closed-without-merge, and still-open PRs, with merge spans spread across hours/days. The easiest natural seed is to run E2E-55 a few times across a span; otherwise insert rows directly.

### Trigger the rollup

**SaaS (Lambda)**:
```bash
aws lambda invoke \
  --function-name mergewatch-insights-rollup-prod \
  --payload '{"installationId": "<id>"}' \
  /tmp/rollup-output.json && cat /tmp/rollup-output.json
```

**Self-hosted**: the hourly cron, or the admin trigger.

### Inspect

Read the `cycleTime` block on each window's `InstallationFPInsight` (DynamoDB `mergewatch-installation-fp-insights` / Postgres `installation_fp_insights`) and hand-compute the percentiles for the seeded merge spans.

## Expected outcomes

- [ ] Each window's insight row carries a `cycleTime` block with the right counts (`mergedCount = reviewedMergedCount + unreviewedMergedCount`).
- [ ] `timeToMergeHours` p50/p75/p90 match a hand-computed percentile of the seeded merge spans.
- [ ] `timeToMergeHoursReviewed` and `timeToMergeHoursUnreviewed` segment correctly; a segment with no PRs is `null` (not `0`).
- [ ] Closed-without-merge and still-open PRs are counted but excluded from every duration percentile.
- [ ] A row with the `prCreatedAt=''` sentinel still counts toward `mergedCount` but is omitted from created→merged percentiles.
- [ ] An installation with no merges yields all-zero counts and `null` percentiles (no crash).

## Failure modes

- ❌ Open or closed-unmerged PRs leak into the time percentiles (skews "faster merges" upward/downward).
- ❌ A negative span (clock skew) feeds the stats instead of being dropped.
- ❌ An empty sample serializes as `{p50:0,p75:0,p90:0}` rather than `null` (dashboard then shows a misleading "0h").
- ❌ Wiring the lifecycle store changes the FP-feedback numbers (the two rollups must be independent).

## How to verify locally

`MANUAL_ONLY` — `grade-run.mjs` reads GitHub, and this fixture asserts on
DynamoDB. See [`e2e/MANUAL-VERIFICATION.md`](../../e2e/MANUAL-VERIFICATION.md)
for the session check and the command shapes.

- **Table** — `mergewatch-installation-fp-insights-dev` (the **dev** stage, never prod)
- **Key** — pk `installationId` · sk `window`
- **Look at** — the time-to-merge percentiles

Record what you checked. A graded run reports this fixture as **NOT VERIFIED**,
and an unrecorded manual pass is indistinguishable from one that never
happened.
