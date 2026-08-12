# E2E-75b: Skip — `maxFiles` boundary is inclusive

The counterpart to **75a**. With the same `rules.maxFiles: 3` ceiling, a PR touching **exactly** `maxFiles` files must still review: the boundary is inclusive (`>` skips, not `>=`). An off-by-one here silently costs users a review on every PR that lands exactly on their configured limit.

## Apply

```bash
./scripts/apply-fixture.sh 75b-maxfiles-boundary
```

The overlay changes **3 files** — the config plus `src/boundary-{a,b}.ts`. `boundary-a.ts` carries one modest genuine concern (`parseInt` with no `NaN` guard) so a real review produces visible output; a silent skip is therefore unambiguous.

**Counting caveat.** If `.mergewatch.yml` is counted among the changed files this PR sits exactly *at* the limit — the true boundary case. If the config file is excluded from the count, the total is 2 and the PR is merely under the limit. The expected outcome is a review either way; read the skip-evaluation log line to confirm which number the gate counted, and record it so the boundary claim is evidence-backed rather than assumed.

## Expected outcomes

- [ ] The PR is **reviewed** — no "Review skipped" check run.
- [ ] The review posts a summary comment and the check run reports a verdict.
- [ ] The `parseInt` / `NaN` concern (or an equivalent) surfaces, confirming agents actually ran on the diff.
- [ ] The skip-evaluation log shows the counted file total against the limit of 3, establishing whether the config file is counted.
- [ ] With `maxFiles` unset, the same PR reviews under the default of 50.

## Failure modes

- ❌ A PR at exactly `maxFiles` is skipped — the comparison is `>=` where it should be `>`.
- ❌ The skip fires but silently, giving the author no signal at all.
- ❌ The review runs but the log never records the counted file total, leaving the boundary unverifiable.
