# E2E-12: Re-run check via GitHub UI

Clicking the "Re-run" button on the MergeWatch check should trigger a fresh review on the same commit **and leave the check run reporting that review's verdict**.

> Manual GitHub-UI action. No fixture overlay.

## Run

Open any completed fixture PR. In the Checks tab, click the `⋯` menu next to "MergeWatch Review" → **Re-run**.

## Expected outcomes

- [ ] A **new** MergeWatch check run appears on the PR's head SHA — `gh api "repos/mergewatch/fixtures/commits/<head-sha>/check-runs?filter=all"` shows one more MergeWatch run than before the click
- [ ] That run's `conclusion` reflects the **new** review's verdict, not the previous one's
- [ ] No MergeWatch check run is left `in_progress`
- [ ] Summary comment is updated in place

The verdict is the point. Since [mergewatch.ai#639](https://github.com/mergewatch/mergewatch.ai/issues/639) the re-run's writes are keyed to a run of their own, so "a run appeared" and "the gate moved" are now the same check. A run count that does not change means the writes landed on the previous review's completed run and branch protection is still reading the old verdict.

To see the verdict actually move, change something between the two runs without pushing a commit — e.g. toggle a blocking org agent in the dashboard. `.mergewatch.yml` is read at the head SHA and cannot change without a push.

## How to verify locally

`MANUAL_ONLY` — `grade-run.mjs` reads GitHub PR state, and this fixture asserts
on a GitHub UI action. See [`e2e/MANUAL-VERIFICATION.md`](../../e2e/MANUAL-VERIFICATION.md).

The trigger must be a real **Re-run click**. `POST /repos/{owner}/{repo}/check-runs/{id}/rerequest` is **not** a substitute: the UI button fires `check_suite.rerequested`, which is the event the webhook acts on, and the REST call on a single run fires `check_run.rerequested` instead. Walking this fixture through REST exercises a different code path from the one users click.

Record what you checked. A graded run reports this fixture as **NOT VERIFIED**,
and an unrecorded manual pass is indistinguishable from one that never
happened.
