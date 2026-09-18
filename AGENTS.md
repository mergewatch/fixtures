# Engineering conventions — MARKER-AGENTS

Conventions the review should enforce on this repository.

## House rule

- **Never use `var`.** Declare with `const`, or `let` when reassignment is
  genuinely required. A `var` declaration is a review-blocking convention
  violation in this codebase.
