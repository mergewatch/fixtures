# E2E-58: Engagement — `/resolve` capture (engagement metrics, stage 1)

Replying `/resolve` (or `/mergewatch resolve`) on a MergeWatch inline-finding thread increments a new `resolveCount` on that finding's `FindingDispositionRecord` — a first-class positive engagement signal, recorded **in addition to** the existing FP-F `disputeCount` increment (resolve still counts toward the FP funnel). The thread is resolved as before. New records and pre-#195 records both default `resolveCount` to 0 (no backfill). Works for both DynamoDB (SaaS) and Postgres (self-hosted).

Manual reply + store inspection; reuses an existing review's inline thread (e.g. E2E-29 cluster, E2E-35 inline-resolve). No fixture PR. Shipped in #207.

## Procedure

Branch: `fixture/58-engagement-resolve`. On a repo with an active review that surfaced ≥1 inline finding, reply `/resolve` on the inline-finding thread. Inspect the disposition record (DynamoDB `mergewatch-finding-dispositions` item, or Postgres `finding_dispositions` row) for the finding's match key.

## Expected outcomes

- [ ] The inline thread is resolved (GraphQL `resolveReviewThread`), as in the pre-#195 behavior.
- [ ] The finding's disposition record shows `resolveCount` incremented by 1 (per resolved match key).
- [ ] `disputeCount` is also incremented by 1 (existing FP-F behavior is unchanged).
- [ ] A record that has never been resolved reads `resolveCount: 0` (default, not missing/`NaN`).
- [ ] Both backends behave identically (Dynamo atomic `if_not_exists` + Postgres `resolve_count + 1`).

## Failure modes

- ❌ `/resolve` only increments `disputeCount` (the resolve engagement signal is lost — the #195 regression).
- ❌ A pre-#195 row throws or reads `undefined`/`NaN` for `resolveCount` (must coerce to 0).
- ❌ The Postgres migration is non-idempotent (no `ADD COLUMN IF NOT EXISTS`) and fails `migrations:check` or a re-run.

## How to verify locally

`MANUAL_ONLY` — `grade-run.mjs` reads GitHub, and this fixture asserts on
DynamoDB. See [`e2e/MANUAL-VERIFICATION.md`](../../e2e/MANUAL-VERIFICATION.md)
for the session check and the command shapes.

- **Table** — `mergewatch-finding-dispositions-dev` (the **dev** stage, never prod)
- **Key** — pk `{installationId}#{owner}/{repo}` · sk = the finding key
- **Look at** — `resolveCount` incremented alongside the disposition

Record what you checked. A graded run reports this fixture as **NOT VERIFIED**,
and an unrecorded manual pass is indistinguishable from one that never
happened.
