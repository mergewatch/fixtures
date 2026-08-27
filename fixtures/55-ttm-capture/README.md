# E2E-55: TTM — PR-lifecycle capture (time-to-merge, stage 1)

Every PR MergeWatch sees writes one `PRLifecycleRecord` (DynamoDB `mergewatch-pr-lifecycle`, Postgres `pr_lifecycle`) — one row per PR, independent of the per-commit `ReviewItem`. The webhook records `opened`/`reopened`/`ready_for_review` → `upsertOpened`, `synchronize` → `recordPush`, and the newly-handled `closed` → `markMerged` (merged) or `markClosedUnmerged` (closed without merge). The review pipeline sets `markReviewed` (set-once `firstReviewAt`) on completion and `markSkipped` when `shouldSkipPR` fires. Writes are best-effort and never block the pipeline.

No harness PR — this is a manual lifecycle fixture (open / push / merge / close by hand). Shipped in #196.

## Procedure

Branch: `fixture/55-ttm-capture`.

1. Open a PR with a non-trivial change so MergeWatch reviews it.
2. Push one more commit to the same PR.
3. Merge it.
4. Separately, open a second PR and **close it without merging**.

### Inspect the lifecycle store

**SaaS (DynamoDB)**:
```bash
aws dynamodb query --profile mergewatch --region us-west-2 \
  --table-name mergewatch-pr-lifecycle-dev \
  --key-condition-expression 'pk = :p' \
  --expression-attribute-values '{":p": {"S": "<installation-id>#mergewatch/fixtures"}}'
```

**Self-hosted (Postgres)**:
```sql
SELECT pr_number, state, pr_created_at, first_review_at, merged_at, closed_at,
       total_pushes, pushes_after_first_review, reviewed, ttl
FROM pr_lifecycle WHERE installation_id = '<id>';
```

## Expected outcomes

- [ ] After open: a lifecycle row exists with `state=open`, `prCreatedAt` set, counters 0.
- [ ] After the extra push: `totalPushes` increments; `pushesAfterFirstReview` increments only once a review has landed (`firstReviewAt` set).
- [ ] After the review completes: `reviewed=true`, `firstReviewAt` set once (a later re-review does NOT move it).
- [ ] After merge: `state=merged`, `mergedAt` set, `prCreatedAt` authoritative from the closed payload, `ttl` populated.
- [ ] The closed-without-merge PR: `state=closed_unmerged`, `closedAt` set, NO `mergedAt`.
- [ ] The `closed` action does NOT trigger a review (no eyes reaction, no new review comment on close).

## Failure modes

- ❌ A `closed` event triggers a fresh review (the close path must terminate the lifecycle, not enqueue a job).
- ❌ A merged row downgrades to `closed_unmerged`, or `upsertOpened`/`recordPush` resurrects a terminal row (terminal-state discipline regressed).
- ❌ A lifecycle write throwing blocks or fails the review (writes must be best-effort).
- ❌ `firstReviewAt` moves on a re-review (it must be set-once).

## How to verify locally

`MANUAL_ONLY` — `grade-run.mjs` reads GitHub, and this fixture asserts on
DynamoDB. See [`e2e/MANUAL-VERIFICATION.md`](../../e2e/MANUAL-VERIFICATION.md)
for the session check and the command shapes.

- **Table** — `mergewatch-pr-lifecycle-dev` (the **dev** stage, never prod)
- **Key** — pk `{installationId}#{owner}/{repo}` · sk = PR number
- **Look at** — `state`, `reviewed`, `firstReviewAt`, `prCreatedAt`, `totalPushes`, `pushesAfterFirstReview`, `mergedAt`, `ttl`

Record what you checked. A graded run reports this fixture as **NOT VERIFIED**,
and an unrecorded manual pass is indistinguishable from one that never
happened.
