# Engineering conventions — MARKER-CONVENTIONS

Conventions the review should enforce on this repository.

## House rule

- **Never use loose equality (`==` / `!=`).** Always use `===` / `!==`. A
  loose comparison is a review-blocking convention violation in this codebase.
