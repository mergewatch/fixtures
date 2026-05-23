# E2E-36a: FP-G — linter-aware style agent (eslint present)

`detectLinters` (in `packages/core/src/config/conventions.ts`) runs in parallel with `fetchConventions`. It performs a single root-listing GitHub API call (`repos.getContent` with `path: ''`), matches the returned entries against the marker tables for `eslint` / `biome` / `ruff` / `flake8` / `clippy` / `golangci` / `stylelint`. The detected set is sorted lexicographically and passed into `ReviewPipelineOptions.detectedLinters`, which threads through to `runStyleAgent`. `STYLE_REVIEWER_PROMPT` has a new `LINTER_AWARE_PLACEHOLDER` (`{{LINTERS_DETECTED}}`); `buildLinterAwareDirective` renders a directive telling the model to defer formatting / lint-equivalent findings.

The directive is **style-agent-specific** — security, bug, error-handling, test-coverage agents are unaffected.

Pair with `36b-no-linter` (same `src/style-bait.ts`, no `eslint.config.mjs`) to verify the inverse.

## Apply

```bash
./scripts/apply-fixture.sh 36a-linter-present-eslint
```

The overlay adds:
- `eslint.config.mjs` at the repo root (triggers `detectLinters → ['eslint']`)
- `src/style-bait.ts` — deeply nested function with missing semicolons + unused import (lint-equivalent AND code-smell bait)
- `src/unrelated.ts` — the unused-import target

## Expected outcomes — linter-present

- [ ] The style agent prompt (visible in agent logs / dashboard "view full details") includes the `LINTER_AWARE_DIRECTIVE` block listing `eslint`
- [ ] Agent log includes `[fp-g] detected linters: eslint`
- [ ] The rendered comment has **no** semicolon / unused-import / formatting-style findings — the style agent deferred to the (assumed) linter
- [ ] Code-smell findings (god functions, deep nesting, magic numbers) DO still appear — only lint-equivalent ones are deferred

## Failure modes

- ❌ Linter-present repo still gets *"missing semicolon"* / *"unused import"* findings
- ❌ Code-smell findings (god functions, nesting) are also suppressed (over-defer — only lint-equivalent should defer)
- ❌ Detection false-positive: a `.eslintrc.json` in a `node_modules/` subdirectory triggers the directive (the scan must be repo-root only)
- ❌ A `pyproject.toml` without `[tool.ruff]` triggers `ruff` (regex must require the explicit table header)
