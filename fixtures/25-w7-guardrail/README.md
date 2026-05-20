# E2E-25: W7 score guardrail — unverified-only Criticals don't block

When the orchestrator emits Critical(s) but the W2 verification pass can't confirm any of them against the file contents (LLM error, unparseable response, no clear verdict, etc.), the bot:
- keeps the findings (fail-safe, never silently drops a real Critical),
- tags each survivor with `verification: 'unverified'`,
- clamps the merge score to **3/5** (would have been ≤ 2/5),
- so the formal PR review event is **COMMENT** (advisory), not **REQUEST_CHANGES** — and the `MergeWatch Review` check stays a non-blocker.

This closes the P13 "no-exit critical" state that pinned **PR #148** at `CHANGES_REQUESTED` × 4 rounds: the bot's residual concern was unverifiable but blocked the PR every commit. Now those land as advisory.

Status: SHIPPED in the W7 PR. Every tier interaction is unit-locked by `reconcileMergeScore` tests.

## Apply

```bash
./scripts/apply-fixture.sh 25-w7-guardrail
```

The overlay adds `src/inscrutable.ts` — a small file with an obvious-looking but ambiguous "issue" that's a known false-positive bait (a parameterised query that *looks* like SQL concat at a glance; an inline integer guard the model often misses on the first pass).

`groundingFetch` must be configured (default on SaaS) so verification actually runs — `verification: 'unverified'` requires that W2 was attempted but didn't return a verdict, not that it was skipped.

## Expected outcomes

- [ ] If a Critical surfaces, the rendered comment shows score `3/5 — Review recommended` (not `2/5 — Needs fixes` or red)
- [ ] Score-reason line includes phrasing like *"could not be confirmed against the source"* / *"verification inconclusive"* / *"advisory"*
- [ ] Formal PR review event = **COMMENT** (not REQUEST_CHANGES)
- [ ] `MergeWatch Review` check status = SUCCESS (advisory), not FAILURE
- [ ] Each surviving Critical row carries the `verification: 'unverified'` tag in the stored review (DynamoDB / Postgres) — verify via the dashboard "View full details" link or the store directly
- [ ] Push a follow-up commit that makes the same code clearly broken (e.g. remove the inline guard); the next review's verification should now confirm the Critical → no clamp → score returns to ≤ 2 + REQUEST_CHANGES. Confirms the guardrail is gated on "W2 inconclusive," not "presence of any Critical."

## Failure modes

- ❌ Score `1/5` or `2/5` with formal review `REQUEST_CHANGES` despite every Critical being unconfirmed by W2 (W7 clamp didn't fire — likely an `allCriticalsUnverified` regression)
- ❌ The Critical was silently dropped (over-suppression — W7 should clamp the SCORE, never the FINDING itself; the finding stays visible as advisory)
- ❌ A confirmed-real Critical (`verification: 'verified'`) was also clamped (clamp should require *every* surviving Critical to be unverified — a mixed set with even one verified Critical must still block)

## Note

The verification verdict is stochastic on real models. To force the clamp in a self-hosted run, swap in an LLM whose `CRITICAL_VERIFICATION_PROMPT` response throws or returns garbage — each Critical gets tagged `unverified` and the clamp triggers deterministically.
