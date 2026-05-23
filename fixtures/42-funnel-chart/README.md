# E2E-42: FB-F — Dashboard FP funnel chart

New `/dashboard/[installation]/insights` route. The funnel is the page's hero chart: stacked bar (or Sankey) showing the four signals from `FindingDispositionRecord`: `unsignaled` (no signal either way) + `agreed` (👍/❤️/🚀) + `silentDropped` (implicit FP) + `disputed` (explicit FP). These four sum to `totalFindingsSurfaced` by construction. Window selector (7d / 30d / 90d). Reads exclusively from `InstallationFPInsight` — no per-finding queries on the page-load path.

Note: original spec said `surfaced → carried → resolved → disputed → silently-dropped`. Shipping v1 uses the four signals above; "carried" + "resolved" need a separate finding-state machine the rollup doesn't yet have — deferred.

No new branch or PR. Pure dashboard inspection.

## Procedure

1. Ensure FB-A data is pre-seeded (see E2E-37 / E2E-41) and at least one nightly rollup row exists.
2. Navigate to `https://mergewatch.ai/dashboard/<installation>/insights` (SaaS) or `http://localhost:3000/dashboard/<installation>/insights` (self-hosted).
3. Inspect the funnel chart.

## Expected outcomes

- [ ] Each bar segment shows count + percentage on hover
- [ ] Disputed segment is visually distinct (warm color)
- [ ] Silently-dropped segment uses a neutral / muted color (signal, not failure)
- [ ] Window selector (7d / 30d / 90d) updates numbers
- [ ] Page reads only the rollup row, not per-finding records
- [ ] Page lighthouse score ≥ 90

## Failure modes

- ❌ Page does an O(N) scan of `FindingDispositionRecord` on every render
- ❌ Funnel widths visually misrepresent the proportions (chart misconfigured)
- ❌ Window selector doesn't update the data (stale prop binding)
