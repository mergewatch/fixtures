# E2E-45: FB-I — Severity-shopping detector chart

Dual-line chart overlaying warnings dispute-rate vs criticals dispute-rate across the three rolling windows (7d / 30d / 90d). An advisory banner (*"Severity-shopping detected. Warnings dispute-rate exceeds criticals by ≥ 1.5× across two adjacent windows…"*) fires when **both** of two adjacent windows (7d + 30d OR 30d + 90d) cross the ratio threshold. One-window spikes are tolerated by design — only persistent skew triggers the banner.

Data plumbing: `FindingDispositionRecord` gains a nullable `severity` column (Postgres migration 0006); `InstallationFPInsight` gains a `perSeverity` bucket (migration 0007). The disposition writer in `recordFindingSurfacings` threads `f.severity` through; `buildInsightFromDispositions` aggregates by severity into the new bucket. Pre-FB-I records (no severity column) land in the `uncategorized` bucket so totals stay consistent on partial-backfill data.

No new branch or PR.

## Procedure — two seeding paths

**Direct fixture**: seed `FindingDispositionRecord` rows where the 30d AND 90d windows both show `warning.rate > critical.rate × 1.5` with each side carrying ≥ 5 surfacings (the `SEVERITY_SHOPPING_MIN_SURFACED` guard).

**Live path**: run a series of PRs where the orchestrator emits warnings that are then disputed, while criticals stay rare and undisputed. Slow but exercises the full pipeline.

Then navigate to `/dashboard/<installation>/insights` and inspect the severity-shopping chart.

## Expected outcomes

- [ ] Two distinct lines render (warnings amber, criticals red) across `7d / 30d / 90d` on the x-axis
- [ ] Annotation banner appears when two adjacent windows both cross the ≥ 1.5× threshold
- [ ] Annotation does NOT appear for single-window spikes
- [ ] Annotation does NOT appear when either side has fewer than 5 surfacings (small-N noise guard)
- [ ] Empty severity data on all windows → renders the "No severity data yet — needs at least one nightly rollup after FB-I shipped" panel, not an all-zero chart
- [ ] Pre-FB-I records (severity = NULL) flow into the `uncategorized` bucket and don't pollute the critical/warning lines
- [ ] Tooltip shows raw `disputed / surfaced` counts alongside the rate for each window

## Failure modes

- ❌ Annotation triggers on a single-window spike (the two-adjacent-window guard regressed)
- ❌ The detector reports severity-shopping when there are very few surfacings (`SEVERITY_SHOPPING_MIN_SURFACED` floor regressed)
- ❌ Pre-FB-I records (no severity field) pollute the `critical` or `warning` line instead of the `uncategorized` bucket
- ❌ A division-by-zero on `warning / critical` when criticals rate is 0 — should evaluate to `Infinity` (handled) and the comparison `Infinity >= 1.5` correctly fires when warnings > 0
