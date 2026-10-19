# E2E-07: Smart-skip bypass via includePatterns

`includePatterns` lets a docs-only PR opt itself back into review.

## Apply

```bash
./scripts/apply-fixture.sh 07-include-patterns
```

## Expected outcomes

- [ ] Full review runs (👀 → in-progress check run → summary comment → COMMENT review; APPROVE only with `approve: true`, mergewatch.ai#706)
- [ ] Summary comment treats the markdown file as a normal source file (no "skipped — only docs" message)
