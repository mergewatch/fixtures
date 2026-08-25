# E2E-12: Re-run check via GitHub UI

Clicking the "Re-run" button on the MergeWatch check should trigger a fresh review on the same commit.

> Manual GitHub-UI action. No fixture overlay.

## Run

Open any completed fixture PR. In the Checks tab, click the `⋯` menu next to "MergeWatch Review" → **Re-run**.

## Expected outcomes

- [ ] Within ~30s a new "in progress" check run appears
- [ ] Summary comment is updated in place
- [ ] Behavior identical to a synchronize event

## How to verify locally

`MANUAL_ONLY` — `grade-run.mjs` reads GitHub PR state, and this fixture asserts
on a GitHub UI action. See [`e2e/MANUAL-VERIFICATION.md`](../../e2e/MANUAL-VERIFICATION.md).

The trigger is a "Re-run" click; `POST /repos/{owner}/{repo}/check-runs/{id}/rerequest` does the same thing without the browser.

Record what you checked. A graded run reports this fixture as **NOT VERIFIED**,
and an unrecorded manual pass is indistinguishable from one that never
happened.
