# E2E-78b: Output shaping — `postSummaryOnClean`

The third knob from **E2E-78**, split out because it needs a *clean* diff while **78a** needs a noisy one. `postSummaryOnClean` decides whether a clean PR gets a comment at all. Teams reviewing dozens of PRs a day often don't want an "all clear" comment on every one.

The load-bearing detail: it suppresses only the **comment**. Both other surfaces still fire — the check run reports its passing conclusion (or the PR loses its merge signal and the setting becomes a footgun), and the formal Review event is still submitted, which on a clean PR is an **APPROVE**.

That second one is worth knowing before you enable this: `postSummaryOnClean: false` makes MergeWatch quiet in the comment thread, **not** invisible. The PR timeline still shows "approved these changes", and where branch protection counts App reviews that approval can satisfy a required-review rule. The setting governs the summary comment, which is what it is named for — nothing else.

## Apply

```bash
./scripts/apply-fixture.sh 78b-post-summary-on-clean
```

The overlay sets `postSummaryOnClean: false` and adds `src/clean-change.ts` — a genuinely clean change (validated input, explicit error handling, no injection surface), modelled on the **E2E-01** clean-PR shape. If it draws findings, the fixture isn't exercising this setting at all; fix the file before reading anything into the result.

Then flip `postSummaryOnClean: true` on the branch and push to confirm the all-clear summary returns.

## Expected outcomes

- [ ] The review completes and finds nothing (control — this is a clean diff).
- [ ] With `postSummaryOnClean: false`, **no** summary comment is posted.
- [ ] The check run **still reports**, with a passing conclusion and the merge score.
- [ ] No inline comments are posted (trivially — a clean PR has no findings to anchor).
- [ ] A formal Review event **is** still submitted, and on a clean PR it is an `APPROVE`. This bullet used to
      say the opposite; the README was wrong and the product was right. `postSummaryOnClean` gates the
      comment only (`review-processor.ts:835`), and `submitPRReview` runs regardless.
- [ ] Flipping to `postSummaryOnClean: true` and pushing restores the "all clear" summary comment.
- [ ] The setting has no effect on a PR that *does* have findings — those still comment regardless.

## Failure modes

- ❌ `postSummaryOnClean: false` also suppresses the **check run**, leaving the PR with no merge signal.
- ❌ The comment is posted anyway (the flag is ignored).
- ❌ The flag leaks into non-clean PRs and suppresses real findings.
- ❌ Flipping back to `true` doesn't restore the summary until a fresh PR is opened.
