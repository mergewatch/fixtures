---
description: Sync fixtures with the upstream e2e/RUNBOOK.md, author any missing fixtures, then run the full suite
allowed-tools: Bash(gh api:*), Bash(gh repo view:*), Bash(ls:*), Bash(scripts/run-suite.sh), Bash(scripts/apply-fixture.sh:*), Bash(git status:*), Read, Write, Edit
---

Sync this fixtures repo with the latest upstream RUNBOOK, fill in any missing
fixtures, then run the whole suite. Upstream is
`mergewatch/mergewatch.ai`, file `e2e/RUNBOOK.md`.

Work through these steps in order. Stop and report if any step can't proceed.

## 1. Fetch the latest RUNBOOK

```bash
gh api repos/mergewatch/mergewatch.ai/contents/e2e/RUNBOOK.md \
  --jq '.content' | base64 -d > /tmp/RUNBOOK.md
```

Read `/tmp/RUNBOOK.md`. It is the authoritative spec — each `E2E-NN` card
defines a scenario, the setup, and the expected MergeWatch behavior.

## 2. Find missing fixtures

List the E2E IDs the RUNBOOK defines vs. the fixture directories present:

```bash
grep -oE 'E2E-[0-9]+[a-z]?' /tmp/RUNBOOK.md | sort -u
ls -1 fixtures/
```

A fixture directory is `fixtures/<NN-name>/`. An ID is **missing** when no
`fixtures/NN*` directory exists for it. Some cards expand into lettered
sub-fixtures (e.g. `E2E-18` → `18a-…`, `18b-…`; `E2E-36` → `36a-…`, `36b-…`) —
follow the RUNBOOK card to decide whether a card needs one fixture or several.
List exactly which fixtures you'll create and confirm the count before authoring.

## 3. Author each missing fixture

Match the existing conventions exactly. Read a recent, structurally similar
fixture first as a template (e.g. `fixtures/52-unverified-critical-render/`)
before writing. Each fixture directory needs:

- **`meta.env`** — `BRANCH`, `TITLE` (format `E2E-NN: <summary> (<guardrail>)`),
  `BODY` (one line, ends by pointing at the README), `DRAFT`. Add
  `SKIP_APPLY` / `MANUAL_ONLY` / `REUSES` / `PUSH_TO_EXISTING_BRANCH` /
  `COMMIT_MESSAGE` / `POST_OPEN_HINT` only when the card calls for reuse,
  manual-only, or sequenced behavior (see `scripts/apply-fixture.sh` for how
  each key is interpreted).
- **`overlay/`** — the source files copied on top of the baseline that trigger
  the scenario. Keep them minimal and targeted at the behavior the card tests.
  Manual-only / reuse fixtures may have no overlay.
- **`README.md`** — fixture summary plus an expected-outcomes checklist,
  mirroring the matching RUNBOOK card.

After authoring, update the fixture index table in the repo `README.md` so it
covers the new IDs.

## 4. Run the full suite

```bash
scripts/run-suite.sh
```

This applies every fixture (opens a real PR per non-manual fixture). To pace
for MergeWatch re-review, pass `SLEEP=60 scripts/run-suite.sh`. Report the
pass/fail summary it prints.

## 5. Report

Summarize: which fixtures were missing and created, the suite pass/fail
counts, and the open PRs that now need verification against their
`fixtures/<name>/README.md`. Remind that `scripts/reset-env.sh` (or
`/reset-env`) tears the run back down.
