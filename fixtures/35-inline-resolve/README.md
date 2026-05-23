# E2E-35: FP-F — inline-reply resolve memory

When a human posts an inline-thread reply matching `detectResolveIntent` (*"resolved"* / *"please resolve"* / *"mergewatch resolve"* / *"/resolve"*), `handleInlineReply` recovers the finding's stable identity keys from the thread root (file `path` from the GitHub review-comment object + title parsed via `extractInlineCommentTitle` → `findingMatchKeys`) and returns them. The server/lambda handlers append the keys to the latest review record's `inlineResolvedKeys` field (dedup, cap 500). The next full review unions `prevComplete.inlineResolvedKeys` with the live-computed W3 `disputedKeys` and feeds the union into both FP-B's previousFindings pre-filter and the downstream W3 `partitionDisputed` suppression.

Fail-safe: if the root inline comment is missing `path` (pre-FP-F shape) or the title can't be parsed (`**🔴 …**` format absent), the keys derivation returns `[]` and resolution proceeds normally — pre-FP-F behavior preserved.

## Apply

```bash
./scripts/apply-fixture.sh 35-inline-resolve
```

The overlay adds `src/admin-endpoint.ts` — an unauthenticated admin endpoint that reliably draws an inline-comment-eligible Critical.

## Step 2 — inline-resolve + sync push (manual)

1. After the first review lands and renders an inline thread on the Critical, reply in that thread **as the PR author**:
   ```
   resolved
   ```
   (or `/resolve`, `please resolve`, `mergewatch resolve`)
2. Confirm the thread shows resolved on GitHub.
3. Push a no-op commit to trigger a re-review:
   ```bash
   git commit --allow-empty -m 'sync' && git push
   ```

## Expected outcomes (re-review)

- [ ] The next review's rendered comment does **not** re-raise the resolved Critical
- [ ] Agent log shows `[fp-f] persisted N inline-resolved key(s) on …` after the inline-resolve, and `[fp-f] unioned N inline-resolved key(s) into disputedKeys (now N total)` on the next review
- [ ] The resolved-finding's key flows into the same `partitionDisputed` machinery W3 uses
- [ ] **Regression check**: a follow-up commit that materially changes the resolved code (fingerprint changes) re-raises the finding (resolution is code-anchored)
- [ ] **Regression check**: an older review record with no `inlineResolvedKeys` field reviews as before — the union becomes a no-op
- [ ] **Regression check**: a non-resolve reply (just discussion) does NOT persist any keys

## Failure modes

- ❌ The resolved finding re-appears on the next review under a slightly different framing (FP-F's stable-key persistence missed the framing change — likely a W9 fingerprint coverage gap surfaced via this path)
- ❌ An unrelated finding gets suppressed (the resolve key was over-broad)
- ❌ The Postgres `inline_resolved_keys` column is missing — migrations didn't run (self-hosted) or the deploy SAM template is stale (SaaS)
