---
description: Full E2E cycle — pre-flight, run the suite, wait for MergeWatch to drain the review queue, grade with /verify-suite, and file upstream issues for regressions
allowed-tools: Bash(git:*), Bash(scripts/run-suite.sh:*), Bash(gh pr list:*), Bash(gh pr view:*), Bash(gh pr comment:*), Bash(gh api:*), Bash(gh issue create:*), Bash(gh issue list:*), Bash(jq:*), Bash(cat:*), Bash(ls:*), Read, Write, Skill
---

Run one complete E2E cycle end to end without stopping between phases. Work
through the phases in order; stop and report only if a phase's blocking
condition can't be met.

## 1. Pre-flight

All of these must hold before applying anything:

- Working tree clean, on `main`, up to date with `origin/main`.
- `main` == `e2e-baseline` locally **and** on origin
  (`git ls-remote origin refs/tags/e2e-baseline refs/heads/main` — the two
  SHAs must match). If the tag lags main, retag and push:
  `git tag -f e2e-baseline main && git push --force origin refs/tags/e2e-baseline`.
- `gh pr list --state open` returns 0 open PRs. If PRs from a prior run are
  still open, run `/reset-env` first (it's destructive — mention you're doing
  it, then proceed; a stale run being torn down is the expected lifecycle).

## 2. Apply the suite

Run `scripts/run-suite.sh` **in the background** (it takes ~10–20 min and
opens a real PR per non-manual fixture; the manifest lands in
`.e2e/last-run.json`).

Expected behaviors that are NOT errors:
- Manual-only fixtures just print instructions.
- `18b-fix-criticals` blocks until 18a's review completes (the
  `PUSH_TO_EXISTING_BRANCH` review-wait) — a multi-minute pause there is the
  fix from mergewatch.ai#375 working, not a hang.

When it finishes, report the `N applied, M failed` summary. If any fixture
failed to apply, investigate before continuing — a missing-fixture error
usually means the `e2e-baseline` tag wasn't moved after a fixtures merge
(step 1 should have caught this).

## 3. Wait for the review queue to drain

MergeWatch reviews queue under burst. Poll in the background until settled:

```bash
for i in $(seq 1 30); do sleep 60; pending=$(gh pr list --state open --limit 100 \
  --json number,statusCheckRollup \
  --jq '[.[] | select((.statusCheckRollup | length) > 0) | select(any(.statusCheckRollup[]; .status != "COMPLETED"))] | length'); \
  echo "poll $i: in-progress=$pending"; \
  if [ "$pending" -eq 0 ] && [ "$i" -gt 3 ]; then echo settled; break; fi; done
```

Notes while interpreting:
- PRs with **no checks at all** are expected for the silence fixtures
  (`04-auto-review-off`, `76b-both-triggers-off`) — don't wait on them.
- A check stuck `in_progress` >10 min with output "Review queued — rate
  limited" is a **stranded throttle-retry** (mergewatch.ai#370 class): nothing
  will ever pick it up. Unstick it with
  `gh pr comment <N> --body "@mergewatch review"` (the `rerequest` API 404s on
  in-progress checks), note it as a finding, and keep waiting for that PR.

## 4. Grade

Invoke the `/verify-suite` skill and follow it fully: it reads
`.e2e/last-run.json`, grades every fixture PR against its
`fixtures/<name>/README.md` rubric (PASS / FAIL / SKIP / PENDING), writes
`.e2e/results.md`, and files one deduped issue per confirmed regression in
`mergewatch/mergewatch.ai`.

Grading judgment accumulated from past cycles — apply it:
- Fan the per-fixture grading out across parallel agents (~8 fixtures each);
  a single pass over 50+ PRs doesn't fit one context.
- Before filing N similar issues, look for one shared root cause (a rate-limit
  die-off, a harness sequencing bug, self-identifying bait) — file ONE
  systemic issue with the per-fixture evidence attached instead of N
  duplicates.
- "Zero findings" on a bait fixture is only a regression if the evidence is
  concrete: a `Suppressed: N` footer proves emitted-then-filtered; no footer
  usually means the bait didn't fire (stochastic → SKIP). Check whether the
  review's own summary/diagram *describes* the defect it then failed to post —
  that's the strongest suppression signature.
- Fixtures whose step 2 is a human turn (mention comments, inline replies,
  reactions, triage) grade SKIP when the turn wasn't performed — never FAIL.

## 5. Report and hand off

One combined summary: apply counts, drain time, PASS/FAIL/SKIP/PENDING tally,
`.e2e/results.md` path, links to every issue filed or updated. Leave the PRs
open for inspection and remind that `/reset-env` tears the run down when the
user is done.
