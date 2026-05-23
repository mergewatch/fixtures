# E2E-32: FP-C — pre-orchestrator cross-agent dedup

When two or more agents flag the same `(file, line)` with overlapping titles, the duplicates are merged **before** the orchestrator's LLM call by `dedupeCrossAgentByLine` (`packages/core/src/finding-clustering.ts`). Reuses W10's `extractSignificantTokens` for title similarity; strongest severity wins; absorbed siblings recorded.

Distinct from W10 clustering, which runs *post-orchestrator* on a wider line region. FP-C handles the exact-`file:line` case that W10's `maxLineSpan` is unnecessarily wide for.

## Apply

```bash
./scripts/apply-fixture.sh 32-cross-agent-dedup
```

The overlay adds `src/exec.ts` — `require('child_process').exec(userCmd)` on line 7. Security (shell injection), bug (no error handler), and error-handling (no try/catch) agents all have an angle on the same line.

## Expected outcomes

- [ ] The orchestrator's input `taggedFindings` was deduplicated (agent log shows count reduction)
- [ ] The rendered comment has **one** finding for the `src/exec.ts:7` concern, not 2–3
- [ ] The merged finding's body lists the absorbed siblings (mirrors W10's audit-trail format)
- [ ] **Regression check**: if two agents flag the same file but DIFFERENT lines (e.g. `:7` and `:50`), they pass through to the orchestrator independently — FP-C only merges exact-line matches

## Failure modes

- ❌ Same `(file, line)` from two agents appears as two rows in "Requires your attention"
- ❌ Two findings on DIFFERENT lines of the same file get merged into one (over-dedup — FP-C must require exact line match)
