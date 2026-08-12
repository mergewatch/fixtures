# Engineering conventions — MARKER-DOTDIR

This file is candidate **#4** — the last in the resolution order. It must be
ignored while any higher candidate exists, and wins only once both
`AGENTS.md` and `CONVENTIONS.md` are gone.

## House rule (unique to this file)

- **Never use the `any` type.** Use `unknown` and narrow, or declare a precise
  type. An `any` annotation is a review-blocking convention violation in this
  codebase.
