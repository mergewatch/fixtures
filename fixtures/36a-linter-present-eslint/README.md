# E2E-36a: FP-G — linter-aware style agent (linter present)

Contract revised per the **mergewatch.ai#376 decision (Option 1)**: the style
prompt's anti-noise hard list excludes lint-equivalent nits **unconditionally**
— semicolons/formatting, import ordering, and anything a linter would enforce
are never bot findings, linter or no linter. `detectLinters` still injects the
reinforcing `LINTER_AWARE_DIRECTIVE` when linters are detected, but it is
reinforcement, not the deciding mechanism. Structural preferences (god
functions, deep nesting, magic numbers) are also hard-listed and NOT findings.

This arm ships a root `eslint.config.mjs` (linter present). The `src/` diff is
**byte-identical to 36b's** and plants:

- Lint-equivalent nits — mixed missing semicolons, an unused import
  (`unusedHelper`), value-import-before-type-import ordering. None may surface.
- **Aliveness control** (in-scope for the narrowed style agent): a
  concrete-impact perf anti-pattern — `withRecomputedTotals` deep-clones every
  order via `JSON.parse(JSON.stringify(...))` inside a `.map` over books that
  the comment notes run to tens of thousands of orders. This must surface.

## Expected outcomes (identical to 36b by design)

- [ ] **No** semicolon / unused-import / formatting / import-order findings —
      the hard list, not linter detection, is the mechanism
- [ ] The perf control (per-item deep clone in a hot loop) **does** appear —
      proves the style agent is alive, not over-suppressed
- [ ] Prompt includes the `LINTER_AWARE_DIRECTIVE` block and the
      `[fp-g] detected linters: eslint` log line (log-only, not gradeable from
      the PR)
- [ ] Regression: security / bug / error-handling / test-coverage prompts
      byte-identical regardless of linter detection (log-only)

## Failure modes

- ❌ Lint-equivalent nits appear (the hard list stopped being honored)
- ❌ The perf control is missing (over-suppression — the agent is dead, not
  restrained; this is what separates #376's intended behavior from a defect)
- ❌ Detection false-positive: a linter config outside the repo root triggers
  the directive (scan is root-only)
