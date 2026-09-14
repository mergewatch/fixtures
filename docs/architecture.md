# Architecture

The codebase is intentionally small — a thin app layer over a set of pure helpers.

## Components

- **App layer** (`src/app.ts`): user-facing entry points. Currently exposes `greet`, which formats a greeting for a given name.
- **Utilities** (`src/utils.ts`): pure arithmetic helpers (`add`, `multiply`). These have no side effects and no external dependencies, so they can be reused anywhere.
- **Tests** (`src/utils.test.ts`): vitest unit tests covering the utility helpers.

## Conventions

- Keep helpers in `src/utils.ts` pure — no I/O, no shared state.
- New public functions should ship with unit tests in the matching `*.test.ts` file.
- Docs live under `docs/` and are reviewed like any other change.
