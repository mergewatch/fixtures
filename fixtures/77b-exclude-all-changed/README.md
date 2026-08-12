# E2E-77b: `excludePatterns` — excluding every changed file

The degenerate case for **E2E-77**. When `excludePatterns` matches *every* file in the PR, the diff handed to the agents is empty. The PR is still not trivial, so it is still reviewed — and the review must complete as a **clean review**, not throw, not hang, and not silently become a skip.

Empty-input paths are where filter layers usually break, which is why this gets its own fixture rather than a bullet in **77a**.

## Apply

```bash
./scripts/apply-fixture.sh 77b-exclude-all-changed
```

The overlay changes exactly two files — `src/api.generated.ts` and `.mergewatch.yml` — and excludes **both**. Excluding the config too is what makes the case genuinely degenerate; otherwise `.mergewatch.yml` would remain in the diff and the agents would still have something to read. The config is loaded from the branch head rather than from the diff, so filtering it out does not disable it.

`src/api.generated.ts` carries a blatant defect (interpolated SQL identifier plus a hardcoded credential) precisely so a clean verdict is *informative*: clean here means "filtered", not "nothing to find".

## Expected outcomes

- [ ] The PR is **reviewed**, not skipped — `excludePatterns` never changes the skip decision.
- [ ] The review completes cleanly: a normal summary comment and a passing check run.
- [ ] **No** findings, and no mention of `api.generated.ts` anywhere in the output.
- [ ] The planted SQL/credential defects do not surface — confirming the file was filtered rather than reviewed.
- [ ] Nothing errors: no `-32603`-style internal failure, no stuck "review in progress", no empty-diff exception in the logs.
- [ ] The review is recorded normally (cost record, disposition rows) rather than being dropped mid-pipeline.

## Failure modes

- ❌ Excluding everything throws instead of returning a clean review.
- ❌ The review never completes and the check run hangs in progress.
- ❌ The excluded file's defects surface anyway (the exclusion didn't apply).
- ❌ The empty agent diff is treated as a skip, so the author sees "Review skipped" instead of a clean result.
