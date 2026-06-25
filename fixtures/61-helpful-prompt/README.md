# E2E-61: Engagement — helpful footer prompt (engagement metrics, stage 4)

Every summary comment renders a one-click prompt — "Was this review helpful? React with 👍 or 👎 on this comment." On each review run the handler polls the summary comment's reaction counts and folds the **positive delta** vs the prior review's `summaryReactionsSnapshot` into the satisfaction store (👍/❤️/🚀 → up, 👎/🤔 → down), monotonically (a removed reaction never decrements). The hourly rollup sums in-window votes into `engagement.helpfulUp/helpfulDown/helpfulRate`, and `/dashboard/analytics` shows a **Helpful rate** StatCard under "Explicit satisfaction". Works on both backends (`mergewatch-satisfaction` DynamoDB table / `helpful_votes` Postgres table).

Manual reaction fixture, no fixture PR. Shipped in #210.

## Procedure

Branch: `fixture/61-helpful-prompt`. On a repo with an active review, confirm the summary comment shows the 👍/👎 prompt, then react 👍 on it. Re-trigger a review (push a commit) so the poll runs, and inspect the satisfaction store (`HV#<repo>#<pr>` item / `helpful_votes` row). Trigger the hourly rollup and open `/dashboard/analytics`.

## Expected outcomes

- [ ] The summary comment renders "Was this review helpful?" with 👍 / 👎.
- [ ] A 👍 on the summary comment is recorded as `up: 1` on the helpful-vote row after the next review poll.
- [ ] Removing the reaction then re-reviewing does NOT decrement the counter (monotonic).
- [ ] The rollup's `engagement` block carries `helpfulUp/helpfulDown/helpfulRate`; the dashboard shows the Helpful rate StatCard.
- [ ] An installation with no satisfaction table provisioned reviews normally (best-effort no-op).

## Failure modes

- ❌ The prompt is missing from the summary footer.
- ❌ A re-review double-counts the same reaction (snapshot delta broken).
- ❌ A satisfaction-store write error blocks the review.
