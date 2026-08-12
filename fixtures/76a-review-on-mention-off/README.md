# E2E-76a: Skip — `reviewOnMention: false`

With `rules.reviewOnMention: false`, an `@mergewatch review` mention does **not** trigger a review. This is the exact inverse of **E2E-05** (where a mention overrides `autoReview: false`), and the two settings interact — see **76b** for the both-off case.

The subtle half of this card is *attribution*: the skip must be recorded as `reviewOnMentionOff`, distinguishable from `autoReviewOff`. If both collapse into one reason, the dashboard's skip breakdown misreports why reviews aren't happening.

## Apply

```bash
./scripts/apply-fixture.sh 76a-review-on-mention-off
```

The overlay sets `autoReview: true` + `reviewOnMention: false` and adds `src/mention-bait.ts` (a `fetch` with no timeout and no non-2xx handling). Because auto-review is still on, the PR reviews **when it opens** — that first review is the control. Then:

1. Confirm the automatic review landed with findings.
2. Comment `@mergewatch review` → **no new review** appears; the existing comment is not re-edited and no new check run fires.
3. Confirm the recorded skip reason is `reviewOnMentionOff`.
4. Comment `@mergewatch <question>` (conversational, not the `review` command) → confirm the behavior is deliberate and matches the documented contract for this flag combination.

## Expected outcomes

- [ ] The PR reviews automatically on open (control — `autoReview: true` is unaffected).
- [ ] `@mergewatch review` produces **no** new review: no new summary comment, no re-edit, no new check run.
- [ ] The recorded skip reason is `reviewOnMentionOff`, **not** `autoReviewOff`.
- [ ] The dashboard skip breakdown attributes the skip to the mention flag.
- [ ] Conversational `@mergewatch <question>` behavior matches the documented contract for this combination.

## Failure modes

- ❌ Mentions still trigger reviews — the flag is ignored.
- ❌ The skip is attributed to `autoReviewOff`, making the dashboard misleading.
- ❌ `reviewOnMention: false` also suppresses the automatic on-open review (over-broad — that's `autoReview`'s job).
