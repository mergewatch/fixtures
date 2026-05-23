# E2E-31: FP-B — pre-filter previousFindings by disputedKeys

Both handlers (`packages/server/src/review-processor.ts`, `packages/lambda/src/handlers/review-agent.ts`) now compute `disputedKeys` before constructing the `runReviewPipeline` options, then use `partitionDisputed(prevComplete.findings, disputedKeys).kept` as the `previousFindings` arg. The orchestrator never sees rebutted prior findings — saves prompt tokens AND eliminates the small set of re-emissions that slip past W3's stable-key match because the model reframed the finding.

Regression-locked by two integration tests in `review-processor.test.ts`.

## Apply

```bash
./scripts/apply-fixture.sh 31-prev-disputed-prefilter
```

Branch: `fixture/31-prev-disputed-prefilter`. The overlay adds `src/data-access.ts` — a data-access function that reliably draws a "DB query lacks error handling" finding (textbook design-opinion the author will rebut).

## Step 2 — author triage + sync push (manual)

After the first review lands, post a top-level PR comment **as the PR author** rebutting the finding by design:

```
## mergewatch triage

⚠️ "DB query lacks error handling" — by design. The caller handles
database errors centrally via withDbRetry middleware; this function
intentionally surfaces raw failures so the upstream handler can apply
the policy.
```

Then push a no-op commit to trigger a re-review:

```bash
git commit --allow-empty -m 'sync' && git push
```

## Expected outcomes (re-review)

- [ ] On the step-2 review, the agent log shows a SMALLER `previousFindings` payload than would otherwise have been computed — the rebutted finding is missing
- [ ] No `[triage-suppressed]` log line for the rebutted finding (it never reached the suppression step — the orchestrator never re-emitted it)
- [ ] Verdict converges on step 2 (no `🆕 new` row for the rebutted concern)
- [ ] **Regression check**: a prior finding that was NOT rebutted is still passed through as `previousFindings` and behaves the same as before FP-B

## Failure modes

- ❌ Rebutted finding is still in the `previousFindings` block (the pre-filter didn't apply)
- ❌ A non-rebutted prior finding gets wrongly excluded (over-filter — the pre-filter must scope to `disputedKeys` only)
