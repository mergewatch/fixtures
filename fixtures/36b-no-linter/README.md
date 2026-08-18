# E2E-36b: FP-G — linter-aware style agent (no linter)

Contract revised per the **mergewatch.ai#376 decision (Option 1)**: this arm is
no longer a retention control. Lint-equivalent nits are excluded by the style
prompt's unconditional anti-noise hard list, so **both arms expect identical
output** — with no linter present the `LINTER_AWARE_DIRECTIVE` placeholder is
simply stripped and no `[fp-g]` log line appears, but the finding set must not
differ from 36a's.

No linter config ships in this arm. The `src/` diff is **byte-identical to
36a's** and plants:

- Lint-equivalent nits — mixed missing semicolons, an unused import
  (`unusedHelper`), value-import-before-type-import ordering. None may surface,
  even without a linter.
- **Aliveness control**: the same concrete-impact perf anti-pattern
  (`withRecomputedTotals` deep-clones every order via
  `JSON.parse(JSON.stringify(...))` in a `.map` over tens of thousands of
  orders). This must surface.

## Expected outcomes (identical to 36a by design)

- [ ] **No** semicolon / unused-import / formatting / import-order findings —
      the hard list applies with no linter anywhere in sight
- [ ] The perf control (per-item deep clone in a hot loop) **does** appear —
      proves the style agent is alive, not over-suppressed
- [ ] No `[fp-g] detected linters:` log line; the directive placeholder is
      stripped from the style prompt (log-only, not gradeable from the PR)

## Failure modes

- ❌ Lint-equivalent nits appear (the hard list stopped being honored)
- ❌ The perf control is missing (over-suppression — the agent is dead, not
  restrained)
- ❌ Detection false-positive: something outside the repo root (or a
  `pyproject.toml` without `[tool.ruff]`) triggers the directive
