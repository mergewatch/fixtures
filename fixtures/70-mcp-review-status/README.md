# E2E-70: MCP — `get_review_status` and the conventions resource

`get_review_status` (required `repo`, `prNumber` ≥ 1) returns the latest review row for a PR, letting an agent poll a review it triggered. The `mergewatch://conventions/{owner}/{repo}` resource serves the repo's resolved conventions markdown as `text/markdown` — the same text the review agents receive, resolved through the documented order (`conventions:` → `AGENTS.md` → `CONVENTIONS.md` → `.mergewatch/conventions.md`, first hit wins).

MCP-surface fixture, no fixture PR. Reuses the PR opened by **E2E-01** and needs an API key from **E2E-71**. The resolution order itself is exercised end-to-end by **E2E-80**; this card only checks that the MCP resource honours it.

## Procedure

1. Open any fixture PR and let it review (**E2E-01**).
2. Call `get_review_status` with that `repo` + `prNumber` → returns the latest row (status, score, findings count).
3. Call it with `prNumber: 0` → `-32602`. Call it with `repo` omitted → `-32602`.
4. Call it for a PR that was never reviewed → an empty/absent result, **not** an error.
5. Re-review that PR (`@mergewatch review`) and poll again → the **new** row is returned, not the stale one.
6. `resources/read` on `mergewatch://conventions/<owner>/mergewatch-fixtures` → returns the repo's `AGENTS.md` content as `text/markdown`.
7. Delete `AGENTS.md`, add `CONVENTIONS.md` → the resource now serves that file (order fallback).
8. Point `conventions:` at a custom path → that file wins over both.
9. Read conventions for a repo **outside** the key's scope → rejected per **E2E-71** (`-32001`), not served.

## Expected outcomes

- [ ] `get_review_status` returns the most recent review for a reviewed PR (and refreshes after a re-review).
- [ ] `prNumber < 1` or a missing `repo` → `-32602`.
- [ ] An unreviewed PR returns an empty result rather than an error.
- [ ] The conventions resource returns `text/markdown` and follows the documented discovery order.
- [ ] A repo with **no** conventions file returns an empty resource, not a 500.

## Failure modes

- ❌ `get_review_status` returns a stale review after a re-review.
- ❌ The conventions resource ignores `conventions:` and always reads `AGENTS.md`.
- ❌ Reading conventions for a repo outside the key's scope succeeds (see **E2E-71**).
