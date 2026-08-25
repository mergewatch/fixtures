# E2E-73: Billing — free-tier exhaustion blocks reviews

Each installation gets **5 lifetime free reviews** (`FREE_REVIEW_LIMIT`). After that, a review runs only when `balanceCents >= MIN_BALANCE_CENTS` (5¢ / `MIN_BALANCE_USD` $0.05). When neither holds, the review is **blocked before it runs** — not run-and-billed — and the installation is notified once.

Billing fixture, no fixture PR of its own: burn the free tier with five ordinary fixture PRs (**E2E-01**, **E2E-02**, **E2E-03**, **E2E-15**, **E2E-26** all produce real reviews), then open a sixth. Needs a **fresh** installation with no payment method, so run this before **E2E-72** / **E2E-74** on the same installation.

## Procedure

1. Open 5 PRs that each produce a real review. Confirm all 5 run and the free counter increments to 5/5.
2. Open a 6th PR → the review is **blocked**. A notification lands (`MergeWatch: reviews paused — credits required`).
3. Confirm the block is logged with a `reason=` and that **no LLM call was made** — no `ReviewCostRecord` was written for the blocked review (cross-check the cost store from **E2E-63**).
4. Open a 7th PR → the block notification does **not** repeat.
5. Confirm the MCP surface returns **`-32002`** (billing blocked) for the same installation.
6. Add credits above 5¢ → the next PR reviews normally, with no restart.
7. Drain the balance below 5¢ → blocked again.
8. Reinstall the app and confirm the free counter does **not** reset, and that it is per **installation**, not per repo.

## Expected outcomes

- [ ] Exactly 5 free reviews run; the 6th is blocked.
- [ ] The free counter is per **installation** and lifetime (not per repo, not per month, not reset by reinstall).
- [ ] Blocking happens **before** the LLM call — no `ReviewCostRecord` for a blocked review.
- [ ] The block notification fires once, not on every subsequent PR.
- [ ] MCP returns `-32002`; the PR surface explains how to resume.
- [ ] Topping above the minimum balance resumes reviews without a restart.

## Failure modes

- ❌ A blocked review still calls the LLM (cost incurred with nothing delivered).
- ❌ The free counter resets on reinstall, or counts per repo.
- ❌ Reviews silently do nothing with no PR-visible explanation.
- ❌ The block notification repeats on every PR.

## How to verify locally

`MANUAL_ONLY` — `grade-run.mjs` reads GitHub, and this fixture asserts on
DynamoDB. See [`e2e/MANUAL-VERIFICATION.md`](../../e2e/MANUAL-VERIFICATION.md)
for the session check and the command shapes.

- **Table** — `mergewatch-installations-dev` (the **dev** stage, never prod)
- **Key** — pk `installationId` · sk `#SETTINGS`
- **Look at** — `freeReviewsUsed` — per installation and lifetime

Record what you checked. A graded run reports this fixture as **NOT VERIFIED**,
and an unrecorded manual pass is indistinguishable from one that never
happened.
