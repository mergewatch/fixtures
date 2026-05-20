# E2E-26: W8 location accuracy — snap to call site, not definition

When a finding references a function by name, `groundFinding` walks every occurrence of the identifier in the file and snaps to the **call site** closest to the LLM's anchor — never to the function's *definition* line when at least one use-site exists. Verifies the PR #39 failure mode: the bot cited `rag.ts:330` (the `function searchViaPostgres(…)` definition) for a finding about the call at line 410.

## Apply

```bash
./scripts/apply-fixture.sh 26-call-site-snap
```

The overlay adds `src/svc.ts` with the function definition near the top and the call site separated by unrelated code (so the def and call are not on consecutive lines). Both regions are in the diff — the bait is that the LLM may anchor a finding about the call at the function's signature line.

## Expected outcomes

- [ ] If a finding about `searchViaPostgres` lands in the rendered comment, its `line` field points at the **call site** (`return await searchViaPostgres([...])` line), NOT at the `export async function searchViaPostgres(…)` line
- [ ] In the inline-comment thread, the comment is anchored on the call line and matches the summary table / Critical block line exactly (single canonical location across all three renderings)
- [ ] If the finding is genuinely about the *definition* (e.g., "function takes too many parameters"), the snap correctly stays on the def line — the W8 heuristic only drops definitions when a **use-site** exists for the same identifier

## Failure modes

- ❌ Finding rendered at the `function searchViaPostgres(…)` line when a call site exists elsewhere in the same file (PR #39 regression)
- ❌ Inline-comment line differs from the summary table line for the same finding (#37 reported `:38` in summary but `:39` inline)
- ❌ A finding about the function's signature gets *incorrectly* snapped away to a call site (over-snap — the W8 fallback should keep def-only findings on the def line; the regression test guards both directions)

## Note

The snap is deterministic given the file contents and finding text. To force the def-line failure pre-W8, inject `{ "file": "src/svc.ts", "line": 1, "severity": "critical", "title": "Missing await on \`searchViaPostgres\` call" }` into the orchestrator response in a self-hosted run and confirm post-W8 it snaps to the call line.
