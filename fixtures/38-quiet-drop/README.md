# E2E-38: FB-B — quiet-drop derived counter

When a finding from the previous review (a) was present in `previousFindings`, (b) is NOT in the current review's output, AND (c) the cited code's fingerprint did NOT change between the two commits → the orchestrator silently dropped it. Each such drop increments `silentDropCount` on the corresponding `FindingDispositionRecord`. This is a strong *implicit* FP signal — the model dropped a finding it had previously emitted on the same code.

## Apply

```bash
./scripts/apply-fixture.sh 38-quiet-drop
```

The overlay adds `src/wavering.ts` — an aggregator the orchestrator's confidence often wavers on across runs (e.g. "consider memoization" / "synchronous loop could be expensive"). Also adds `docs/notes.md` so step 2 has an unrelated file to edit without touching the cited code.

## Step 2 — unrelated-file commit (manual)

After the first review surfaces a finding X on `src/wavering.ts`, edit `docs/notes.md` (or add a new unrelated comment somewhere), commit + push:

```bash
echo "<!-- bump $(date +%s) -->" >> docs/notes.md
git commit -am 'unrelated: bump notes' && git push
```

## Expected outcomes

- [ ] Review #1 surfaces a finding X on `src/wavering.ts` → DB row `silentDropCount = 0`
- [ ] After step 2 push:
  - If review #2 OMITS X → DB row `silentDropCount = 1` (quiet drop counted)
  - If review #2 KEEPS X → no-op (legitimate carry-over)
- [ ] `silentDropCount` only increments when the cited code's fingerprint is byte-identical across commits
- [ ] An edit to the cited code that legitimately resolves the finding does NOT increment `silentDropCount`
- [ ] Quiet drops feed into the FB-E rollup's "carried → resolved" arc, not the "disputed" arc — separately countable

## Verifying the DB state

SaaS (DynamoDB): `aws dynamodb get-item --table-name mergewatch-finding-disposition-prod --key '{ "...":{...} }'` (key shape per `FindingDispositionRecord`).

Self-hosted (Postgres): `SELECT surface_count, dispute_count, silent_drop_count FROM finding_dispositions WHERE repo_full_name = 'santthosh/mergewatch-fixtures' AND finding_match_key = '<key>';`

## Failure modes

- ❌ A finding resurfaces under a slightly different title and the prior version gets counted as "silently dropped" (W9 fingerprint must drive the match, not the title alone)
- ❌ A finding the author actively addressed via code (legitimate resolve) increments `silentDropCount` (the code-change check is missing or wrong)

## Note

The "quiet drop" is *stochastic* — the orchestrator may keep the finding both times. If review #2 keeps X, that exercises the regression-check path (no false counter increment) and the fixture is still useful.
