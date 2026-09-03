# E2E-01: Clean PR → full review

A PR with no issues should produce 5/5 "No issues found in the diff", an APPROVE on the formal PR review with **empty body** (verdict block removed in #132), and a summary comment with "All clear!".

> Relies on the baseline shipping `src/utils.test.ts` so the test-coverage agent sees `add` as a pre-existing covered function. Without that, the agent fires "new public function lacks tests" on a JSDoc-only diff.

## Apply

```bash
./scripts/apply-fixture.sh 01-clean-pr
```

## Expected outcomes

- [ ] 👀 reaction within ~10s
- [ ] In-progress check run "Review in progress" appears
- [ ] Summary comment with:
  - [ ] MergeWatch wordmark (~48px tall) at top
  - [ ] `🟢 5/5 — No issues found in the diff` verdict line, followed by the scope sub-line
        (`Reviewed the diff only — …`), which renders on 4–5 only
  - [ ] `🎉 All clear! No issues found` action-items section
  - [ ] No "Requires your attention" table (zero critical + zero warning)
- [ ] Formal PR review state = **Approved**
- [ ] Approved review has **NO body text** (regression of #132 if it does)
- [ ] Completed check run "MergeWatch Review" → success
- [ ] +1 👍 reaction (success signal)
- [ ] 👀 reaction is **removed** once review completes — only 👍 remains

## Failure modes

- ❌ PR review has a body that says "X/5 — verdict — view details" (regression of #132)
- ❌ Multiple summary comments instead of one edited-in-place
- ❌ 👀 reaction still present after completion (regression of #138 eyes-cleanup)
- ❌ "Requires your attention" table with a "no test coverage" warning — the agent firing on an unchanged public function (regression of #138 prompt tightening)
