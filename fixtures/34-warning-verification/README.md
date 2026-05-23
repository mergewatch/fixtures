# E2E-34: FP-E — W2 verification extended to warnings

`verifyFindings` (renamed from `verifyCriticalFindings` in `packages/core/src/agents/reviewer.ts`) now also processes `warning`-severity findings using the same shared `FINDING_VERIFICATION_PROMPT`, the same fail-safe semantics (missing file → no LLM call, no tag; LLM error / parse error / no verdict → keep + `verification: 'unverified'`; explicit `valid: false` → drop; explicit `valid: true` → keep + `verification: 'verified'`). Info-severity findings continue to pass through untouched.

The W7 score-clamp in `reconcileMergeScore` still only inspects criticals — extending it to warnings was deferred per the original plan. The `verification` tag on warnings is informational + used by downstream delta/UX surfaces.

Closes the severity-shopping loophole (downgrading a Critical to Warning to dodge verification).

## Apply

```bash
./scripts/apply-fixture.sh 34-warning-verification
```

The overlay adds `src/parse.ts` — `parseChunks` does runtime validation upstream via `validateChunk`, but ends with `return raw as { id: string }[]` (the bait line). The model often warns "type assertion without runtime validation" — the verifier should drop it on the full-file context.

## Expected outcomes

- [ ] Each surviving warning carries a `verification: 'verified' | 'unverified'` tag in the persisted review record
- [ ] If the verification pass says `valid: false`, the warning is dropped (same semantics as criticals)
- [ ] Info-severity findings pass through untouched (no verification call, no tag)
- [ ] **Regression check**: criticals continue to be verified with identical semantics
- [ ] **Regression check**: missing file content for a warning skips the call entirely (no LLM cost spike)
- [ ] Tokens / cost on the Review details collapsible reflect the additional LLM calls (one per warning)

## Failure modes

- ❌ A warning still has no `verification` field in the stored record post-FP-E
- ❌ A legitimately-warning-flagged issue gets dropped because the verifier model is biased toward `valid: false` on warning-severity prompts (mitigation: the shared `FINDING_VERIFICATION_PROMPT` was rewritten to be severity-neutral; `severity` is included in the verifier input)

## Note

If the W7 score-guardrail policy is extended to warnings later (separate decision), the formal Review event would downgrade when every surviving warning is `unverified` — explicitly out of scope for FP-E.
