# Architecture

The fixtures repo is intentionally minimal — see `src/` for the baseline tree and `fixtures/` for per-test overlays.

## Components

- **Baseline**: a small TypeScript surface (`src/app.ts`, `src/utils.ts`) chosen because it's large enough to produce meaningful diffs and small enough that review noise is obvious.
- **Overlay**: each fixture lays files on top of the baseline tree. The fixture's branch carries one commit on top of `e2e-baseline`.
- **Reset path**: `scripts/bootstrap.sh` returns the working tree to the tagged baseline between runs.

## Why this fixture exists

`includePatterns` should pull docs-only diffs back into the review path. Without this override, the smart-skip path would fire (see E2E-06).
