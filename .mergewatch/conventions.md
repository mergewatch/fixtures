# Engineering conventions — MARKER-DOTDIR

Conventions the review should enforce on this repository.

## House rule

- **Never use the `any` type.** Use `unknown` and narrow, or declare a precise
  type. An `any` annotation is a review-blocking convention violation in this
  codebase.
