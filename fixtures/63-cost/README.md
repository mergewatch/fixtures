# E2E-63: Cost — LLM spend rollup + dashboard (#193)

On every completed review the handler writes a `ReviewCostRecord` (tokens, estimated USD, finding count, model) into the cost store, keyed per (installation, repo, PR, commit). The hourly rollup aggregates a `cost` block onto each `InstallationFPInsight` (7d / 30d / 90d): **total spend** (priced reviews), **avg cost / review**, **cost / finding**, token totals, a **per-repo** spend bucket, and a **priced / unpriced** review split. Reviews on a model not in the pricing table are recorded with `costUsd: null`, counted as **unpriced**, and excluded from the money totals (but their tokens still count). `/api/insights` returns the block unchanged; `/dashboard/analytics` renders an **LLM cost** section (StatCards + spend-by-repo + spend-over-time bar). Works on both backends (`mergewatch-review-costs` DynamoDB table / `review_costs` Postgres table).

Seed-and-rollup + dashboard fixture, no fixture PR. Shipped in #212.

## Procedure

Branch: `fixture/63-cost`. Trigger a few reviews (ideally across two repos, and one re-review on a new commit). Inspect the cost store (`<repo>#<pr>#<commit>` items / `review_costs` rows). Trigger the hourly rollup (EventBridge → `insights-rollup` Lambda on SaaS, or the self-hosted cron) and open `/dashboard/analytics`.

## Expected outcomes

- [ ] Each completed review produces one `ReviewCostRecord`; a re-review on a new commit adds a distinct row.
- [ ] The rollup's `cost` block shows total spend, avg cost/review, cost/finding, and a per-repo breakdown matching the recorded reviews.
- [ ] The dashboard LLM cost section renders the StatCards, spend-by-repo list, and spend-over-time bar; `null` averages show `—`.
- [ ] A review on an unknown/unpriced model is counted in `reviewCount` and surfaced as "N unpriced", but excluded from `totalCostUsd` and the averages.
- [ ] A pre-#193 rollup row (no `cost`) renders the page unchanged; an installation with no cost store provisioned reviews normally.

## Failure modes

- ❌ An unpriced review drags `totalCostUsd` / averages toward 0 (must be excluded, not coerced to 0).
- ❌ A re-review on the same commit double-counts (must overwrite idempotently).
- ❌ A cost-store write error blocks the review.
