# E2E-51: FP-J L2 — verifier honours prior recommendations

The same prior-context block from FP-H L2 also surfaces prior **recommendations** (from `previousFindings[].suggestion`). The verifier prompt gains a third INVALID condition: *"the current finding contradicts a prior recommendation"*. Prior advice is binding for the duration of the PR — re-reviews cannot dispute the bot's own prior fixes.

This is Layer 2. Layer 1 (use FB-A dispute-rate counters in `reconcileMergeScore` to down-weight low-confidence findings) and Layer 3 (comment-footer disclosure of dispute-rate context) are covered by E2E-53.

## Apply

```bash
./scripts/apply-fixture.sh 51-no-self-contradiction
```

The overlay adds `src/fetcher.ts` — an unwrapped `await fetch(url); return res.json()` that reliably draws a "add try/catch around the fetch call" recommendation on the first review.

## Step 2 — apply the suggested fix (manual)

After round-1 lands a recommendation (e.g. *"add try/catch around the fetch"*), edit `src/fetcher.ts` to apply the **exact** fix the bot suggested:

```ts
export async function loadRemote(url: string): Promise<unknown> {
  try {
    const res = await fetch(url);
    return res.json();
  } catch (err) {
    console.error('[loadRemote] fetch failed', err);
    throw err;
  }
}
```

Commit + push:

```bash
git commit -am 'fix: add try/catch around fetch (per round-1 recommendation)' && git push
```

## Expected outcomes (round-2 re-review)

- [ ] Round-2 does NOT produce a finding that critiques the application of the fix (e.g. *"the try/catch is unhandled"* / *"the error handler doesn't log enough"*)
- [ ] If round-2 ALSO finds a NEW unrelated defect Y, Y still surfaces normally (FP-J only suppresses contradiction-of-own-advice, not net-new findings)
- [ ] The verifier prompt visibly contains the prior suggestion text in its prior-context block (agent log / dashboard "view full details")
- [ ] **Regression check**: a first review (no `previousFindings`) verifies findings with no prior-context block — same shape as before FP-J landed

## Failure modes

- ❌ Genuine new defects on code that happens to be near a prior fix get incorrectly dropped as "contradicting prior advice"
- ❌ Prior recommendations are passed in raw verbatim, allowing prompt-injection via crafted prior suggestion text (sanitisation must already cover this — same `sanitizePreviousFindingString` path used by `buildPreviousFindingsBlock`)
