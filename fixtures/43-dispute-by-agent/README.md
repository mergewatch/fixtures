# E2E-43: FB-G — Dispute-rate by agent bar chart

Horizontal bar chart on the `/insights` route showing `perCategory` dispute rates in the active window, with severity colouring (red ≥ 50%, amber ≥ 25%, indigo otherwise). The window selector (7d / 30d / 90d) lets the operator compare windows manually.

Note: original spec said *line chart over time, one line per agent category*. True time-series requires per-day rollup buckets the FB-E job doesn't yet emit (we have one rollup snapshot per night with 7d/30d/90d sliding windows). Upgrade to true time-series when FB-E gains a per-day rollup mode.

No new branch or PR. Pure dashboard inspection.

## Procedure

1. Ensure FB-A data is pre-seeded with disputes spanning multiple agent categories (`security`, `bug`, `style`, `errorHandling`, `testCoverage`, `commentAccuracy`, `custom`).
2. Navigate to `/dashboard/<installation>/insights`.
3. Inspect the dispute-rate bar chart.

## Expected outcomes

- [ ] One bar per active agent category — categories with zero surfacings are omitted (not zero-rendered)
- [ ] Legend is interactive (click to toggle)
- [ ] Date range follows the window selector (shared with FB-F)
- [ ] When `disputeRate` is undefined for a bucket (no surfacings), the bar is omitted or shows neutral, not a fake zero
- [ ] Severity colouring: red ≥ 50%, amber ≥ 25%, indigo otherwise

## Failure modes

- ❌ A bar drops to zero on a "no data" category, suggesting an improvement that didn't actually happen
- ❌ Agent categories the org has disabled still render as zero-bars (UX clutter)
