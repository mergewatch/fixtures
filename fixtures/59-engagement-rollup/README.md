# E2E-59: Engagement — Tier 1 rollup (engagement metrics, stage 2)

The hourly insights rollup attaches an `engagement` block to each `InstallationFPInsight` (7d / 30d / 90d) with Tier-1 behavioral KPIs: **acceptance rate** (`agreements / (agreements + disputes + silentDrops)`), **command usage** (`/resolve` + `/mergewatch reject` counts), an **approximate finding-action rate** (`(agreements + resolves) / surfaced`, capped at 1), **re-review rate** (reviewed PRs re-pushed after first review), `reviewedPrCount`, and `activeInstallation`. Rates are `null` (not `0`) when their denominator is empty. The block computes from the disposition records alone (re-review KPIs refine when the PR-lifecycle store is wired). Persisted on both backends as a nullable `engagement` jsonb/attribute.

Seed-and-rollup fixture, no fixture PR. Shipped in #208.

## Procedure

Branch: `fixture/59-engagement-rollup`. Use an installation with disposition + PR-lifecycle history (👍/👎 reactions, `/resolve`, `/mergewatch reject`, reviewed PRs with later pushes). Trigger the hourly rollup (EventBridge → `insights-rollup` Lambda on SaaS, or the self-hosted cron) and inspect the stored insight rows.

## Expected outcomes

- [ ] Each window row carries an `engagement` block with the seven Tier-1 fields.
- [ ] `acceptanceRate` matches `agreements / (agreements + disputes + silentDrops)` for in-window records; `null` when nothing was acted on.
- [ ] `commandUsageCount` = `totalResolves + totalRejectCommands`; rejects are windowed by their own `rejectReasons[].at`.
- [ ] `findingActionRateApprox` is capped at 1 even when a finding has both a 👍 and a `/resolve`.
- [ ] `reReviewRate` = reviewed-PRs-re-pushed / reviewed-PRs in-window; `null` and `activeInstallation: false` when no reviewed PRs.
- [ ] A pre-#195 rollup row (no `engagement`) still reads back fine — the field stays `undefined`.
- [ ] Identical numbers on DynamoDB and Postgres for the same inputs.

## Failure modes

- ❌ A rate reads `0` where it should be `null` (no data), making an empty install look like a 0% install.
- ❌ Rejects windowed by `lastSeen` instead of `rejectReasons[].at` (drops in-window rejects on long-lived records).
- ❌ `findingActionRateApprox` exceeds 1 (uncapped proxy).
- ❌ The `engagement` jsonb migration is non-idempotent (no `ADD COLUMN IF NOT EXISTS`).
