---
description: Grade the last run-suite against each fixture's expected outcomes and auto-file one issue per regression in mergewatch.ai
allowed-tools: Bash(gh api:*), Bash(gh pr view:*), Bash(gh pr list:*), Bash(gh issue create:*), Bash(gh issue list:*), Bash(cat:*), Bash(ls:*), Read, Write
---

Grade the most recent suite run: compare what MergeWatch actually did on each
fixture PR against that fixture's expected outcomes, write a results report,
and file a GitHub issue upstream for every regression.

Upstream repo for issues: `mergewatch/mergewatch.ai`.

## 1. Load the run manifest

```bash
cat .e2e/last-run.json
```

This maps each fixture → its PR number (`pr: null` for manual/reuse fixtures
with no PR of their own). If the manifest is missing, fall back to discovering
open fixture PRs with `gh pr list --state open --json number,headRefName,title`
and matching `headRefName` to `fixtures/*/meta.env` BRANCH values. Report and
stop if neither yields fixtures to grade.

## 2. Grade each fixture

For every fixture with a PR number, gather MergeWatch's actual output:

```bash
gh pr view <N> --json reviews,comments,statusCheckRollup
gh api repos/<owner>/mergewatch-fixtures/pulls/<N>/comments   # inline comments + markers
gh api repos/<owner>/mergewatch-fixtures/pulls/<N>/reviews    # formal review states
```

Read `fixtures/<name>/README.md` — the **Expected outcomes** checklist and the
**Failure modes** list are the rubric. Judge each fixture as:

- **PASS** — all checkable expected outcomes hold; no failure mode tripped.
- **FAIL (regression)** — a failure mode is present, or a required expected
  outcome is clearly violated (wrong review state, missing inline anchor,
  wrong score/check-run conclusion, a guardrail that didn't fire, etc.).
- **SKIP** — the fixture is stochastic, manual, UI-only, or reuse-based
  (the README says so, or `pr: null`), so it can't be graded deterministically
  from API output. Do NOT file issues for SKIPs.

Only grade FAIL when the evidence is concrete — quote the observed value vs.
the expected one. When MergeWatch simply hasn't reviewed yet (no review +
check-run still pending), mark **PENDING**, not FAIL, and note it may need a
re-run after MergeWatch finishes (~30–90s).

## 3. Write the results report

Write `.e2e/results.md` with a summary table (fixture · PR · verdict) followed
by a section per non-PASS fixture: expected, observed, and the README clause it
tripped. Print the table to the user.

## 4. File one issue per regression (auto)

For each FAIL, before filing, dedupe against existing open issues:

```bash
gh issue list -R mergewatch/mergewatch.ai --state open --search "E2E-NN in:title"
```

If no matching open issue exists, create one immediately (no confirmation):

```bash
gh issue create -R mergewatch/mergewatch.ai \
  --title "E2E-NN regression: <fixture name>" \
  --label bug --label mergewatch \
  --body "<body>"
```

Issue body must contain: the fixture id + name, the fixtures-repo PR link, the
specific **Expected** outcome, the **Observed** behavior (quote the review
state / comment / check-run evidence), the README **Failure mode** clause it
matches, and a steps-to-reproduce line (`scripts/apply-fixture.sh <name>`). If
a matching open issue already exists, add a comment with the new occurrence
instead of opening a duplicate.

## 5. Report

Summarize: PASS / FAIL / SKIP / PENDING counts, the path to `.e2e/results.md`,
and links to every issue created or updated. If any fixtures were PENDING,
suggest re-running `/verify-suite` once MergeWatch has caught up.
