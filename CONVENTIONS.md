# Engineering conventions — MARKER-CONVENTIONS

This file is candidate **#3** in the resolution order. It must be ignored
while `AGENTS.md` exists, and must win once `AGENTS.md` is deleted.

## House rule (unique to this file)

- **Never use loose equality (`==` / `!=`).** Always use `===` / `!==`. A
  loose comparison is a review-blocking convention violation in this codebase.

If the review cites the loose-equality rule while `AGENTS.md` is still
present, the discovery order has regressed.
