# E2E-77a: Diff filter — `excludePatterns`

`excludePatterns` removes matching files from the diff **sent to the agents**, without affecting whether the PR is reviewed at all. It is the *diff-filter* layer — distinct from `includePatterns` (**E2E-07**), which operates at the *PR-skip* layer. Confusing the two is the failure this fixture is built to catch.

## Apply

```bash
./scripts/apply-fixture.sh 77a-exclude-generated
```

The overlay sets `excludePatterns: ["**/*.generated.ts"]` and adds **two files carrying the same planted SQL-injection defect**:

- `src/handler.ts` — not excluded. Its defect **must** be reported.
- `src/api.generated.ts` — excluded. Its defect must **never** be reported.

Making the two defects identical in shape is deliberate: it removes "the model just didn't notice" as an explanation. If one is flagged and the other isn't, the filter is doing the work.

The runbook card names `src/utils.ts` for the control role; this fixture uses a fresh `src/handler.ts` so the baseline's co-located `src/utils.test.ts` coverage isn't disturbed — an added public function in `utils.ts` would draw unrelated test-coverage findings and muddy the signal.

Pair with **77b-exclude-all-changed** for the exclude-everything case.

## Expected outcomes

- [ ] The PR **is** reviewed — `excludePatterns` does not change the skip decision.
- [ ] The `handler.ts` SQL-injection defect is flagged (critical) with an inline comment.
- [ ] `api.generated.ts` never appears — not in findings, not in inline comments, not in the "work done" file list, not as a node in the Mermaid diagram.
- [ ] The excluded file's identical defect is absent, confirming exclusion rather than oversight.
- [ ] `excludePatterns` and `includePatterns` compose as documented: a path can be force-included for the skip decision and still excluded from the diff.
- [ ] With `excludePatterns` unset, the defaults (`**/*.lock`, `**/package-lock.json`, `**/dist/**`, `**/node_modules/**`) apply.

## Failure modes

- ❌ An excluded file still produces an inline comment or a finding.
- ❌ The excluded file appears in the diagram or the reviewed-files list even without a finding.
- ❌ `excludePatterns` silently suppresses the whole PR — confusing it with `includePatterns`.
- ❌ Both defects are missed, making the result uninterpretable (re-run; the control must fire).
