# E2E-57: TTM — dashboard cycle-time section (time-to-merge, stage 3)

`/dashboard/analytics` renders a **Cycle time** section above the FP-feedback charts: StatCards (median time-to-merge, from-first-review, round-trips, merged count, each with a p75 · p90 spread) plus a reviewed-vs-unreviewed time-to-merge bar comparison. Durations format as `m`/`h`/`d`; a `null` percentile renders as `—`. The zero-state gate is relaxed so the page shows when **either** FP-feedback **or** cycle-time has data, each section gated independently. No new API route — `/api/insights` returns the `cycleTime` block.

Dashboard-inspection fixture; reuses the **E2E-56** seeded installation. No fixture PR. Shipped in #199.

## Procedure

Branch: `fixture/57-ttm-dashboard`. Use the E2E-56 seeded installation. Open `/dashboard/analytics?org=<installationId>` and switch the 7d/30d/90d window selector.

## Expected outcomes

- [ ] The Cycle time section renders above the FP funnel with correct StatCard values for the active window.
- [ ] The reviewed-vs-unreviewed bar chart shows both series; a tooltip formats hours as `m`/`h`/`d`.
- [ ] Switching the window selector updates the cycle-time numbers.
- [ ] A `null` percentile (e.g. no unreviewed merges) renders `—`, never `0h`.
- [ ] A repo with merges but **zero findings ever surfaced** still shows the Cycle time section (the relaxed gate); a fresh install with neither shows the "No insights yet" panel.
- [ ] An older rollup row without a `cycleTime` block renders the page unchanged (no Cycle time section, FP charts as before).

## Failure modes

- ❌ The page hides everything when `totalFindingsSurfaced === 0`, hiding cycle-time for a merge-active repo (the old gate; must be relaxed).
- ❌ A `null` percentile renders as `0h` (misleading "instant merge").
- ❌ The section throws on a pre-Stage-2 rollup with no `cycleTime` (must be optional).
