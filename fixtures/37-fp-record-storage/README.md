# E2E-37: FB-A — FindingDispositionRecord storage + writers

Every surfacing of a finding upserts a `FindingDispositionRecord` keyed by `(installationId, repoFullName, findingMatchKey)` — incrementing `surfaceCount`, refreshing `lastSeen`, capturing category + topAgent + sigTokens. The W3 path increments `disputeCount`; FP-F inline-resolve increments `disputeCount` AND continues to populate `inlineResolvedKeys` on `ReviewItem` (back-compat). W2 verdicts increment `verifiedCount` / `unverifiedCount`. Records are read by FB-E's nightly rollup only — no per-review read on the dashboard path.

This is a pure DB-inspection fixture. No new branch or PR is needed.

## Procedure

Reuse an existing multi-finding PR:

1. Apply a fixture that produces ≥ 2 findings — e.g. `./scripts/apply-fixture.sh 29-cluster` (4 criticals + 1 warning on seed.ts) or `./scripts/apply-fixture.sh 23-convergence` (coverage warning on swallow.ts).
2. Wait for MergeWatch to review.
3. Inspect the DB for the `FindingDispositionRecord` rows.

### Inspecting rows

**SaaS (DynamoDB)**:
```bash
aws dynamodb scan \
  --table-name mergewatch-finding-disposition-prod \
  --filter-expression 'repoFullName = :r' \
  --expression-attribute-values '{":r": {"S": "santthosh/mergewatch-fixtures"}}'
```

**Self-hosted (Postgres)**:
```sql
SELECT finding_match_key, surface_count, dispute_count, verified_count, unverified_count, last_seen
FROM finding_dispositions
WHERE repo_full_name = 'santthosh/mergewatch-fixtures'
ORDER BY last_seen DESC;
```

## Expected outcomes

- [ ] One row per distinct `findingMatchKey` per repo, never duplicates across reviews
- [ ] `firstSeen` set once on creation; `lastSeen` refreshed on every surfacing
- [ ] `disputeCount` increments on every W3 dispute AND every FP-F inline-resolve hitting that key
- [ ] `verifiedCount` / `unverifiedCount` increment on every W2 pass that produces the corresponding verdict for that key
- [ ] **Regression check**: `ReviewItem.inlineResolvedKeys` continues to work exactly as before — FB-A is additive

## Three-step exercise (optional)

1. Apply a fresh fixture (e.g. `29-cluster`) → confirm new rows exist with `surfaceCount = 1`, no disputes.
2. Post a `## mergewatch triage` reply rebutting one finding → re-review → confirm the rebutted row's `disputeCount = 1`.
3. Push a no-op commit → re-review → confirm rows now have `surfaceCount = 2` (the rebutted one was suppressed pre-orchestrator via FP-B but its surfacing on review #1 still counts).

## Failure modes

- ❌ Two records get created for the same finding because `findingMatchKey` was computed inconsistently across writers
- ❌ A failed write blocks the review pipeline (writes must be best-effort / async)

## How to verify locally

`MANUAL_ONLY` — `grade-run.mjs` reads GitHub, and this fixture asserts on
DynamoDB. See [`e2e/MANUAL-VERIFICATION.md`](../../e2e/MANUAL-VERIFICATION.md)
for the session check and the command shapes.

- **Table** — `mergewatch-finding-dispositions-dev` (the **dev** stage, never prod)
- **Key** — pk `{installationId}#{owner}/{repo}` · sk = the finding key
- **Look at** — the disposition and its counters

Record what you checked. A graded run reports this fixture as **NOT VERIFIED**,
and an unrecorded manual pass is indistinguishable from one that never
happened.
