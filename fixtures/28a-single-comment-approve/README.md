# E2E-28a: Single comment — APPROVE path

Half of E2E-28 (W6 single authoritative review comment). This is the **APPROVE** branch: a trivial JSDoc-only diff in `src/utils.ts` (same shape as E2E-01) — the run should yield one upserted issue comment carrying the verdict, plus one formal PR Review object whose rendered body is **empty** (the `body` field is omitted entirely on APPROVE).

Pair with `28b-single-comment-critical` for the REQUEST_CHANGES branch.

## Apply

```bash
./scripts/apply-fixture.sh 28a-single-comment-approve
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
- [ ] The formal Review's rendered body is empty (`body` field omitted):
  ```bash
  gh api repos/<owner>/<repo>/pulls/<N>/reviews | jq '.[-1].body'   # → null
  ```
- [ ] In the GitHub UI, the Review timeline entry shows only *"mergewatch approved these changes"* plus the inline-comment count — **no** verdict text body below the label
- [ ] The summary comment IS the verdict surface: 1-5 score, mergeScoreReason, findings table, etc.
- [ ] No standalone inline-comment Review events

## Failure modes

- ❌ Two issue comments authored by `mergewatch[bot]` (upsert regressed — `findExistingBotComment` failed to find the marker)
- ❌ APPROVE Review has a body field present (legacy: omit entirely for APPROVE)
- ❌ Multiple formal Review objects on the same commit (`dismissStaleReviews` failed)
