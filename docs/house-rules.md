# Engineering conventions — MARKER-HOUSE

This file is **not** in the auto-discovery chain at all. It is only reachable
by pointing `conventions: docs/house-rules.md` at it explicitly in
`.mergewatch.yml` — which this fixture does not do by default. It exists here
so the explicit-override step can be exercised without a second apply.

## House rule (unique to this file)

- **Never call `console.log`.** Use the structured logger. A bare
  `console.log` is a review-blocking convention violation in this codebase.

If the review cites the `console.log` rule with no `conventions:` key set,
auto-discovery is reaching a file it should never see.
