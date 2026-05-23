# E2E-52: FP-L — propagate W2 verification to rendering surfaces

W2 already tags critical findings with `verification: 'unverified'` when the verifier can't confirm the defect against the source file, and W7 clamps the merge score to ≥3 for an all-unverified-criticals batch. **Before FP-L** the same finding still rendered as a 🔴 inline comment + a row in the "Requires your attention" table + a Critical-section entry — three visual surfaces shouting "blocking!" while the formal verdict whispered "advisory." **After FP-L** the verification tag propagates all the way to rendering: unverified criticals drop from `buildInlineComments` and from the action-items table, and surface instead in a new "⚠️ Unverified concerns (N)" sub-section with the disclaimer *"The verifier couldn't confirm these against the source. Review carefully; the PR is not blocked on them."*

Pure rendering change — no model calls, no prompt changes, no schema migrations.

## Apply

```bash
./scripts/apply-fixture.sh 52-unverified-critical-render
```

The overlay adds `src/store-call.ts` — a `store.query(SELECT … '${id}')` call where the abstraction's internal sanitization isn't visible from this file. The model often emits a "SQL injection" critical here; the verifier often returns `unverified` (cannot confirm or refute against `store.query`).

The cleanest repro is to mock the W2 verifier path so a specific critical comes back as `verification: 'unverified'`. The live path is stochastic — FP-K may also drop the finding as `valid: false` if it pattern-matches a known-safe abstraction.

## Expected outcomes — assuming an unverified critical surfaces

- [ ] **Inline-comment surface**: No 🔴 review comment is created at the cited line (`buildInlineComments` filter rejects `verification === 'unverified'`)
- [ ] **Action-items table**: The unverified critical does NOT appear in the top-of-comment "Requires your attention" table
- [ ] **Critical section**: The standard `### 🔴 Critical (N)` header counts only verified criticals — when all criticals are unverified, this header is omitted
- [ ] **Unverified concerns section**: A new `### ⚠️ Unverified concerns (M)` sub-section renders below, with the advisory subtitle *"The verifier couldn't confirm these against the source. Review carefully; the PR is not blocked on them."*
- [ ] **Empty-case omission**: When there are zero unverified criticals, the "Unverified concerns" sub-section is omitted entirely — no empty headers
- [ ] **W7 score-clamp unchanged**: The formal verdict subtitle still reads *"3/5 — Review recommended. Downgraded to advisory — the PR is not blocked on unverified concerns"* and `mergeScoreToReviewEvent` still returns `COMMENTED`
- [ ] **Back-compat**: A critical with no `verification` field (pre-W2 stored record OR a path where W2 didn't run) renders normally in all surfaces

## Failure modes

- ❌ Unverified critical still renders as 🔴 inline at the cited line (Layer 1 filter regressed)
- ❌ The action-items table still includes the unverified row (Layer 2 filter regressed)
- ❌ The "Unverified concerns" header renders with `(0)` count when no unverified criticals exist (empty-omission check)
- ❌ Verified criticals incorrectly land in the Unverified concerns section (the verification check is inverted)
- ❌ Warnings tagged `verification: 'unverified'` get mis-routed to the Critical Unverified-concerns section (FP-L is explicitly critical-only)
