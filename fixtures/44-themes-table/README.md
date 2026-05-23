# E2E-44: FB-H — Top recurring FP themes table

Sortable table on the `/insights` route. Reads `InstallationFPInsight.topClusters` (top 10 by default). Columns: representative title, sigTokens (as chips), surfaceCount, disputeCount, disputeRate, lastSeen, "View findings" drill-through.

Note: drill-through link to a filtered reviews view is deferred (the `/reviews` route doesn't yet accept a `match-key` query param). For v1 the row is expandable inline; the drill-through link can land when the reviews-filter API is added.

No new branch or PR.

## Procedure

1. Pre-seed with three recognisable clusters — e.g. ~10 "missing await on async X" findings, ~7 "type assertion without runtime validation", ~5 "consider memoization". Can be seeded naturally by running the relevant fixtures repeatedly with rebuttals, or directly via a DB write script.
2. Navigate to `/dashboard/<installation>/insights` and inspect the themes table.

## Expected outcomes

- [ ] Three distinct cluster rows (no over-merging, no under-merging)
- [ ] sigTokens chips include the cluster's distinguishing tokens (e.g. `await`, `async` for the missing-await cluster)
- [ ] Sort by every column works; default sort is `disputeRate × surfaceCount` desc
- [ ] Row expands inline (drill-through deferred)
- [ ] Representative title is the highest-surfacing member, not the longest

## Failure modes

- ❌ Clusters merge across categories ("missing await" and "missing semicolon" both have generic stop-tokens that overlap)
- ❌ A cluster's representative title is the longest member rather than the highest-surfacing one
- ❌ Drill-through 404s (will land later once the reviews-filter API is wired)
