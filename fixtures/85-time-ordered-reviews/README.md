# E2E-85: #335 — Time-ordered DynamoDB review listing

The SaaS dashboard's `listReviews` queries the `ByRepoCreatedAt` GSI
(PK `repoFullName`, SK `createdAt`) descending — true reverse-chronological
order regardless of PR numbers (the base sort key orders `"9#…" > "42#…" >
"100#…"` as strings). Date-range bounds sit in the `KeyConditionExpression`, so
`Limit` applies to matching items and a narrow range can no longer silently
discard matching rows beyond the first unfiltered page. `limit` bounds the
merged cross-repo result; v2 cursors resume each repo from the last *returned*
item, so rows fetched but dropped by the global slice are re-fetched, never
lost. On a stack without the GSI, the store logs one warning and degrades to the
legacy base-table path (sticky per instance); v1 cursors finish their sequence
on the legacy path. Shipped in #335 (PRs #344 + #345).

Seeding + inspection fixture, no fixture PR.

## Procedure

Seed one repo with reviews for PR numbers 9, 42, 100, and 1000 whose
`createdAt` order deliberately disagrees with PR-number order (e.g. 100 newest,
then 1000, 42, 9), plus a second repo with interleaved timestamps and a batch of
rows older than 30 days.

1. `/dashboard/reviews` (SaaS): confirm the list renders in `createdAt` order —
   100, 1000, 42, 9 — not 9, 42, 1000, 100.
2. Apply a "last 7 days" date filter on `/dashboard/analytics`: confirm the
   totals equal the seeded in-range row count exactly (previously: whatever
   survived the first unfiltered 500-item read).
3. Page through `/api/reviews?limit=4` across both repos to exhaustion: confirm
   every seeded row appears exactly once.
4. On a stack without the GSI (dev before infra deploy): confirm the one-time
   `ByRepoCreatedAt index not found` warning and that the list still renders
   (legacy order).

## Expected outcomes

- [ ] Time order across PR numbers 9 / 42 / 100 / 1000 (never PR-number-string
      order)
- [ ] Date-filtered totals count all matching rows, independent of how many
      out-of-range rows precede them
- [ ] `limit` bounds the merged result; full pagination is loss-free and
      duplicate-free
- [ ] GSI-absent stack degrades to legacy with a single warning, no hard failure
- [ ] Read cost on a date-filtered query scales with matching rows, not with
      rows read-and-discarded

## How to verify locally

`MANUAL_ONLY` — `grade-run.mjs` reads GitHub, and this fixture asserts on
DynamoDB. See [`e2e/MANUAL-VERIFICATION.md`](../../e2e/MANUAL-VERIFICATION.md)
for the session check and the command shapes.

- **Table** — `mergewatch-reviews-dev` (the **dev** stage, never prod)
- **Key** — pk `repoFullName` · sk `prNumberCommitSha` (`{pr}#{sha}`)
- **Index** — `ByRepoCreatedAt`, pk `repoFullName` · sk `createdAt` — the one
  actually under test; the base table's SK is what sorts `"9#…"` above `"100#…"`
- **Look at** — that the GSI read returns `createdAt`-descending order, and that
  a date-bounded read counts every matching row rather than whatever survived
  the first unfiltered page

```bash
aws dynamodb query --profile mergewatch --region us-west-2 \
  --table-name mergewatch-reviews-dev --index-name ByRepoCreatedAt \
  --key-condition-expression 'repoFullName = :r' \
  --expression-attribute-values '{":r": {"S": "mergewatch/fixtures"}}' \
  --no-scan-index-forward --limit 10 \
  --query 'Items[].[createdAt.S,prNumberCommitSha.S]' --output text
```

Compare that ordering against the same query without `--index-name`: the base
table returns PR-number-string order, which is the bug this fixture pins.

Record what you checked. A graded run reports this fixture as **NOT VERIFIED**,
and an unrecorded manual pass is indistinguishable from one that never
happened.
