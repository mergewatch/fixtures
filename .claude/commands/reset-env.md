---
description: Tear down the E2E environment — close all open PRs, delete fixture branches, reset main to e2e-baseline
allowed-tools: Bash(scripts/reset-env.sh), Bash(gh pr list:*), Bash(git branch:*), Bash(git status:*)
---

Run a full reset of the mergewatch-fixtures E2E environment.

Execute `scripts/reset-env.sh` from the repo root. It performs a destructive
full teardown with no confirmation:

1. Closes every open PR and deletes its remote branch.
2. Deletes every remote branch except `main`.
3. Resets `main` to the `e2e-baseline` tag and cleans untracked cruft
   (preserving `fixtures/` and `scripts/`).
4. Deletes every local branch except `main`.
5. Prunes stale remote-tracking refs.

Preserved: the `e2e-baseline` tag, `fixtures/`, `scripts/`, and `main`. PR
history remains on GitHub; only the open/branch state is torn down.

After it finishes, report the final branch, head commit, and open-PR count
from the script output.
