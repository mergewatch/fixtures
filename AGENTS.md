# Engineering conventions — MARKER-AGENTS

This file is candidate **#2** in the resolution order (after an explicit
`conventions:` setting, which this fixture deliberately leaves unset). With no
`conventions:` key present, this file must WIN and the three lower candidates
must never be fetched.

## House rule (unique to this file)

- **Never use `var`.** Declare with `const`, or `let` when reassignment is
  genuinely required. A `var` declaration is a review-blocking convention
  violation in this codebase.

If the review cites the `var` rule — and only the `var` rule — resolution is
correct. If it cites any of the other three markers, the order is wrong.
