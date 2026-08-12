# E2E-75a: Skip — `maxFiles` ceiling exceeded

A PR with more changed files than `rules.maxFiles` (default **50**) is skipped with a **visible** check run explaining why. This is the distinguishing property of the `maxFiles` `RulesSkipKind`: unlike `autoReviewOff` (**E2E-04**), which must leave zero PR trace, this skip is *surfaced* so the author knows why nothing happened.

## Apply

```bash
./scripts/apply-fixture.sh 75a-maxfiles-over
```

The overlay sets `rules.maxFiles: 3` and changes **5 files** — the config plus `src/limit-{a,b,c,d}.ts`. Five is over the ceiling whether or not `.mergewatch.yml` itself is counted in the changed-file total, so the over-limit assertion holds under either convention. Pair with **75b-maxfiles-boundary** for the inclusive-boundary case.

After the skip lands, comment `@mergewatch review` on the PR to confirm the mention overrides it.

## Expected outcomes

- [ ] The PR is skipped, and the skip is **visible** — a "Review skipped" check run, not silence.
- [ ] The check run states **which** limit was hit and names the configured value (3).
- [ ] The recorded skip reason is the `maxFiles` kind, distinct from `autoReviewOff` and from the docs-only smart skip (**E2E-06**).
- [ ] No review comment and no findings are posted while the skip is in force.
- [ ] `@mergewatch review` overrides the skip and a full review runs.
- [ ] With `maxFiles` unset, the default of **50** applies — a 5-file PR reviews normally (verify by removing the config and pushing).

## Failure modes

- ❌ The skip is silent — that behavior is reserved for `autoReviewOff`.
- ❌ An over-limit PR is reviewed anyway, burning tokens on a 200-file diff.
- ❌ The check run doesn't say which limit was hit.
- ❌ `@mergewatch review` cannot override the skip.
