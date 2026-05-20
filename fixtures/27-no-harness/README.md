# E2E-27: W11 scope awareness — test-coverage suppression when the repo documents no harness

When the repo's conventions document (AGENTS.md / CLAUDE.md / configured conventions file) declares no test harness — e.g. *"No unit test suite currently"* — the review pipeline must collapse N "lacks test coverage" findings from the test-coverage agent into a **single info-level note**, anchored at the first test-coverage finding's file. Verified the P5 nag-wave observed on voice-bot #31 and orca #37–#39 (≥5 "X lacks coverage" warnings on infra/enablement PRs in repos that explicitly weren't going to have tests yet).

## Apply

```bash
./scripts/apply-fixture.sh 27-no-harness
```

The overlay adds an `AGENTS.md` with the explicit *"No unit test suite currently"* declaration, plus three new files (`src/kb-store.ts`, `src/migrations.ts`, `src/server.ts`) exporting public functions that the test-coverage agent will reliably flag.

## Expected outcomes

- [ ] In the rendered comment, the "Info" collapsible has exactly **one** entry titled *"Test-coverage findings suppressed — repo documents no test harness"* (or close paraphrase)
- [ ] The Info note's description states the suppressed count (e.g. *"4 test-coverage findings rolled up into this note"*) and points back at the conventions document
- [ ] The "Warnings" section contains **no** "lacks test coverage"-class findings
- [ ] `Suppressed N` in the Review details collapsible reflects the rollup (N includes the suppressed test-coverage count)
- [ ] Agent log includes `[scope-awareness] suppressed N test-coverage finding(s)…`

## Regression check — opt-in only (manual step 2)

Remove the "No unit test suite" line from AGENTS.md and push another commit; the next review should **restore** per-function coverage findings (suppression is opt-in via the declaration, not permanent).

## Failure modes

- ❌ The "Warnings" section still contains per-function "lacks coverage" findings despite the AGENTS.md declaration (`detectNoTestHarness` regression — the phrase didn't match)
- ❌ A non-coverage warning (security / bug / style) was incorrectly suppressed (over-filter — the suppression must scope to `category === 'test-coverage'` only)
- ❌ The aggregate info note appears even when there were zero coverage findings to suppress (no-op-on-empty regression)
- ❌ Removing the declaration in a follow-up commit does NOT restore per-function findings (suppression became sticky)

## Note

`detectNoTestHarness` is deliberately conservative — it requires an explicit declaration ("No unit test suite", "tests are out of scope", "no test harness", etc.). A casual mention of "tests" anywhere in AGENTS.md does NOT trigger suppression. If the test-coverage agent is still nagging on a repo that genuinely has no harness, the fix is to add the declaration to AGENTS.md, not to widen the regex.
