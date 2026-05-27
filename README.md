# mergewatch-fixtures

Scratch repo for [MergeWatch](https://github.com/apps/mergewatch) end-to-end tests.

The authoritative test procedure lives in the main repo: [`mergewatch.ai/e2e/RUNBOOK.md`](https://github.com/santthosh/mergewatch.ai/blob/main/e2e/RUNBOOK.md).

## Layout

```
src/                  # baseline source tree fixtures mutate
fixtures/             # one directory per E2E-NN card from the runbook
  <NN-name>/
    overlay/          # files copied on top of the baseline working tree
    README.md         # fixture summary + expected-outcomes checklist
scripts/
  bootstrap.sh        # re-create the seeded baseline from scratch
  apply-fixture.sh    # reset → branch → overlay → push → open PR
```

## Workflow

```bash
# one-time: tag the baseline (only needed on a fresh clone)
./scripts/bootstrap.sh

# run a fixture
./scripts/apply-fixture.sh 01-clean-pr

# tear down between runs
gh pr close <N> --delete-branch
```

See `fixtures/<NN-name>/README.md` for each fixture's expected outcomes — those are the assertions you verify manually after the PR is open.

The seed commit is tagged `e2e-baseline`. `apply-fixture.sh` always resets to this tag before applying an overlay so fixtures stay reproducible.

---

### Note from E2E-06

This paragraph exists to provide a docs-only diff for the smart-skip fixture.
