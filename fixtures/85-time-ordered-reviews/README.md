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

- **Table** — `mergewatch-installation-fp-insights-dev` (the **dev** stage, never prod)
- **Key** — pk `installationId` · sk `window`
- **Look at** — ordering of the contributing records

Record what you checked. A graded run reports this fixture as **NOT VERIFIED**,
and an unrecorded manual pass is indistinguishable from one that never
happened.
