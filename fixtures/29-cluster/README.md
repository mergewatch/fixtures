# E2E-29: W10 finding consolidation — fragments on the same region merge

When the multi-agent pipeline emits multiple findings about the same underlying concern in the same code region — same file, line-span ≤ 50, ≥ 1 shared "significant" token across title + description — `clusterFindings` must collapse them into **one** finding carrying the strongest severity, the earliest cited line, and a *"Related concerns clustered into this finding"* list of the absorbed siblings. The reader sees one row in "Requires your attention" where they would have seen N.

Canonical reproduction: voice-bot PR #37 raised three findings about a single "validate the parsed S3 chunk file" concern — `seed.ts:82` (type assertion without runtime validation), `seed.ts:130` (untrusted JSON parsing without validation), `seed.ts:150` (SQL injection risk in dynamic construction). All three share *validation / structure / chunk* tokens; transitively they cluster (`:82↔:130` is 48 lines, `:130↔:150` is 20 lines, both within span 50).

## Apply

```bash
./scripts/apply-fixture.sh 29-cluster
```

The overlay adds `src/seed.ts` with three deliberately-overlapping bait regions (untrusted JSON parsing, type assertion without validation, dynamic SQL VALUES) inside a tight line window.

## Expected outcomes

- [ ] The rendered "Requires your attention" table shows **one** row referencing the parsed-chunk-file region, NOT 2-3 separate rows about validation / type assertion / untrusted JSON
- [ ] The merged finding's title ends with *"… — and N related concern(s)"*
- [ ] The merged finding's body contains a *"Related concerns clustered into this finding (W10):"* block listing each absorbed sibling with its original `file:line`, severity, and title
- [ ] The merged finding's severity = the **strongest** severity in the cluster (critical > warning > info)
- [ ] Agent log includes `[clustering] merged N related finding(s) into existing clusters`
- [ ] `Suppressed N` in the Review details collapsible reflects the cluster reduction (N includes the absorbed count)

## Over-cluster regression check (manual)

If the diff contains two genuinely-distinct concerns on the same file but in **different code regions** (e.g. one at line 20, one at line 300), they should NOT merge. Verify by adding a second unrelated public function with its own issue at the bottom of `src/seed.ts` and confirming both rows still appear in the rendered table.

## Failure modes

- ❌ All N findings still appear separately in the table (clustering didn't fire — probable cause: no shared significant token after stop-word filtering; check `extractSignificantTokens` on the actual titles)
- ❌ Two findings on the same file in **different code regions** got merged into one (over-cluster — `maxLineSpan` may have been widened too far, or the token-overlap heuristic accepted a coincidental match)
- ❌ The merged finding's severity is NOT the strongest in the cluster (severity-rank tie-break bug)
- ❌ The merged finding's body lost the audit trail (the "Related concerns" list is missing or truncated)

## Note

`clusterFindings` is deliberately conservative. If you observe under-clustering in production (related findings should have merged but didn't), widen the heuristic via the `ClusterOptions` knobs (`maxLineSpan`, `minTokenOverlap`) rather than removing the cluster-size cap. Over-clustering would hide distinct issues under one heading — much worse than the noise it eliminates.
