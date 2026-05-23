# E2E-46: FB-J — Per-repo FP heatmap

Heatmap on the `/insights` route. Rows = repos (top 20 by surfacings, expandable). Reads `InstallationFPInsight.perRepo` cross-rollup-window.

Note: original spec said grid of repos × time buckets with cell colour = disputeRate. v1 ships a *horizontal bar* heatmap (one row per repo, bar width = surfaceCount, bar colour = disputeRate). Same data, simpler layout — true time-series cells need per-day rollup buckets the FB-E job doesn't yet emit. Repos with < 3 surfacings render at 40% opacity to avoid noisy single-event highlights.

No new branch or PR.

## Procedure

1. Pre-seed 5 repos with distinct dispute patterns (one consistently noisy, one consistently clean, three mixed).
2. Navigate to `/dashboard/<installation>/insights` and inspect the per-repo heatmap.

## Expected outcomes

- [ ] Noisy repo's row is visually distinct (warm cells / dark bar)
- [ ] Empty cells (no surfacings in that bucket / repo) are rendered as neutral, not warm
- [ ] Sort by total disputes desc by default
- [ ] Repo names link through to the per-repo reviews view
- [ ] Repos with < 3 surfacings render at 40% opacity (noisy-single-event guard)

## Failure modes

- ❌ A repo with very few surfacings looks "noisy" because the single dispute hits 100% disputeRate
- ❌ A repo deleted from the org keeps showing up (must clean stale repos out of the rollup)
