# E2E-76b: `autoReview: false` + `reviewOnMention: false` — no trigger path

The composition case for **E2E-76**. With both flags off, *nothing* can start a review: opening the PR doesn't (that's `autoReview`, **E2E-04**) and mentioning the bot doesn't (that's `reviewOnMention`, **76a**). Together they are a complete off switch, and the PR must stay entirely silent.

The second property is attribution. Even though both attempts are suppressed, they are suppressed for **different reasons** — the open attempt by `autoReviewOff`, the mention attempt by `reviewOnMentionOff`. Collapsing them into a single reason loses the signal the dashboard needs.

## Apply

```bash
./scripts/apply-fixture.sh 76b-both-triggers-off
```

The overlay disables both flags and adds `src/silent-bait.ts` — a hardcoded API token plus an unbounded `while (true)` loop. This is bait the pipeline would never pass over quietly, so **any** review output on this PR means a trigger path leaked.

After the PR opens, wait out the usual review window, confirm silence, then comment `@mergewatch review` and confirm it stays silent.

## Expected outcomes

- [ ] Opening the PR produces **zero** trace: no summary comment, no inline comments, no check run, no review event.
- [ ] `@mergewatch review` produces zero trace as well.
- [ ] The open attempt records the `autoReviewOff` skip reason.
- [ ] The mention attempt records the `reviewOnMentionOff` skip reason — the two are distinguishable, not merged.
- [ ] No LLM call is made for either attempt (no `ReviewCostRecord` — cross-check against **E2E-63**).

## Failure modes

- ❌ Either path produces a review — the hardcoded token surfacing is the giveaway.
- ❌ Both suppressions record the same skip reason, so the dashboard can't tell which flag is responsible.
- ❌ The skip is surfaced as a visible check run — `autoReviewOff` is specified as silent (contrast **E2E-75a**, where `maxFiles` *must* be visible).
