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

This applies every fixture (opens a real PR per non-manual fixture) and writes
a run manifest to `.e2e/last-run.json`. To pace for MergeWatch re-review, pass
`SLEEP=60 scripts/run-suite.sh`. Report the apply pass/fail summary it prints.

## 5. Grade the run

Once MergeWatch has reviewed (~30–90s after apply), run `/verify-suite`. It
reads the manifest, compares each PR's actual MergeWatch output against the
fixture's expected outcomes, writes `.e2e/results.md`, and auto-files one issue
in `mergewatch/mergewatch.ai` per regression.

## 6. Report

Summarize: which fixtures were missing and created, the apply pass/fail counts,
and that `/verify-suite` should grade behavior next. Remind that
`scripts/reset-env.sh` (or `/reset-env`) tears the run back down.

## Keep TAGS and MODE in step (#416)

Every fixture's `meta.env` carries `TAGS=` (what it covers) and `MODE=` (how it
is verified). When authoring a new fixture, set both — a fixture with no `TAGS`
is invisible to `--tag` and to `--changed-files` selection, so it silently stops
being part of impacted runs while still looking present in the index.

Then check the reverse direction: if the new fixture covers an area no path in
`e2e/impact-map.yml` maps to, add the mapping. A product path that maps to
nothing falls through to the full suite — safe, but it defeats the point of
selective runs.

Verify with:

```bash
scripts/select-fixtures.sh --tag <new-tag>      # exits 2 if the tag matches nothing
scripts/run-suite.sh --changed-files <paths> --dry-run --explain
```
