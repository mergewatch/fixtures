# E2E-36b: FP-G — no linter detected (control case)

Inverse of `36a-linter-present-eslint`: same `src/style-bait.ts` but **no** `eslint.config.mjs`. `detectLinters` returns `[]`, no `LINTER_AWARE_DIRECTIVE` is rendered, and the style agent should emit its full set of findings (lint-equivalent AND code-smell).

## Apply

```bash
./scripts/apply-fixture.sh 36b-no-linter
```

## Expected outcomes — no-linter

- [ ] No `LINTER_AWARE_DIRECTIVE` in the prompt (placeholder stripped)
- [ ] No `[fp-g] detected linters:` log line emitted
- [ ] Style findings (including lint-equivalent ones: missing semicolons / unused import) are emitted as before
- [ ] **Regression check**: the security / bug / error-handling / test-coverage agent prompts are byte-identical regardless of linter detection (style-only injection)

## Failure modes

- ❌ Style findings disappear despite no linter detected (over-defer — the directive should only fire on detected linters)
- ❌ A non-style agent's prompt changes in this fixture (FP-G must be style-only)
