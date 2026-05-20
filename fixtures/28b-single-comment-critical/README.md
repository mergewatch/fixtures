# E2E-28b: Single comment — REQUEST_CHANGES path

Half of E2E-28 (W6 single authoritative review comment). This is the **REQUEST_CHANGES** branch: an unauthenticated admin endpoint that reliably draws one Critical — the run should yield one upserted issue comment carrying the verdict, plus one formal PR Review object whose rendered body is the HTML-comment-only stub `<!-- mergewatch-review -->` (GitHub's UI renders zero visible content for that body).

Pair with `28a-single-comment-approve` for the APPROVE branch.

## Apply

```bash
./scripts/apply-fixture.sh 28b-single-comment-critical
```

## Expected outcomes

- [ ] **One** issue comment authored by `mergewatch[bot]`:
  ```bash
  gh pr view <N> --json comments -q '.comments | length'   # → 1
  ```
- [ ] **One** formal PR Review authored by `mergewatch[bot]` (post-`dismissStaleReviews`):
  ```bash
  gh pr view <N> --json reviews -q '.reviews | length'     # → 1
  ```
- [ ] The formal Review's rendered body is the HTML-comment stub:
  ```bash
  gh api repos/<owner>/<repo>/pulls/<N>/reviews | jq '.[-1].body'
  # → "<!-- mergewatch-review -->"
  ```
- [ ] In the GitHub UI, the Review timeline entry shows only *"mergewatch requested changes"* plus the inline-comment count — **no** verdict text body below the label
- [ ] The summary comment IS the verdict surface: 1-5 score, mergeScoreReason, findings table, etc.
- [ ] Inline comments for the Critical(s) are bundled under the single formal Review — no standalone inline-comment Review events

## Failure modes

- ❌ Formal Review's rendered body contains *"Critical issues found"* / *"Review recommended"* — duplicate of summary comment verdict line (W6 `reviewBody = ''` change regressed)
- ❌ Two issue comments authored by `mergewatch[bot]` on the same PR run (upsert path regressed — `findExistingBotComment` failed to find the marker)
- ❌ Multiple formal Review objects on the same commit (`dismissStaleReviews` failed; should leave exactly one non-dismissed Review per run)

## Note

The HTML-comment stub `<!-- mergewatch-review -->` is the same marker used by the upserted issue comment. That's intentional — both surfaces share one identifier so future tooling can find them by a single grep.
