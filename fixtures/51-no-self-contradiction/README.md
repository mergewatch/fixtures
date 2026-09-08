# E2E-51: FP-J L2 — verifier honours prior recommendations

The same prior-context block from FP-H L2 also surfaces prior **recommendations** (from `previousFindings[].suggestion`). The verifier prompt gains a third INVALID condition: *"the current finding contradicts a prior recommendation"*. Prior advice is binding for the duration of the PR — re-reviews cannot dispute the bot's own prior fixes.

This is Layer 2. Layer 1 (use FB-A dispute-rate counters in `reconcileMergeScore` to down-weight low-confidence findings) and Layer 3 (comment-footer disclosure of dispute-rate context) are covered by E2E-53.

## Apply

```bash
./scripts/apply-fixture.sh 51-no-self-contradiction
```

The overlay adds `src/fetcher.ts` with a **missing `await`** in `loadAll`:
`results.push(loadRemote(u))` pushes Promises rather than values, so the
function returns garbage. It typechecks clean, so only a reviewer catches it.

> **Why not the old bait (fixtures#2431).** This used to rely on the unwrapped
> `await fetch(url); return res.json()` drawing *"add try/catch around the
> fetch"*. **W11 later told the model the opposite**, in the shared preamble:
>
> > Do not flag "missing try/catch around DB query" / "should swallow / log the
> > error here" on a function whose contract is "throw on failure."
>
> `loadRemote` is exactly such a function, so the fixture was asking for a
> finding the product deliberately suppresses. It was not flaky — it was
> **obsolete**, and it failed the gate on an unrelated change. A missing
> `await` is exempted by nothing: it ships wrong behaviour, and the fix is one
> concrete edit, which is what step 2 needs.

## Step 2 — apply the suggested fix (manual)

After round-1 lands the recommendation, apply the **exact** fix the bot
suggested — normally adding the missing `await`:

```ts
export async function loadAll(urls: string[]): Promise<unknown[]> {
  const results: unknown[] = [];
  for (const u of urls) {
    results.push(await loadRemote(u));
  }
  return results;
}
```

Commit + push:

```bash
git commit -am 'fix: await loadRemote (per round-1 recommendation)' && git push
```

## Expected outcomes (round-2 re-review)

- [ ] Round-2 does NOT produce a finding that critiques the application of the fix. The natural self-contradiction here is *"awaiting inside a loop is sequential — use `Promise.all`"*, which directly disputes the bot's own round-1 advice to add the `await`. FP-J must suppress it.
- [ ] If round-2 ALSO finds a NEW unrelated defect Y, Y still surfaces normally (FP-J only suppresses contradiction-of-own-advice, not net-new findings)
- [ ] The verifier prompt visibly contains the prior suggestion text in its prior-context block (agent log / dashboard "view full details")
- [ ] **Regression check**: a first review (no `previousFindings`) verifies findings with no prior-context block — same shape as before FP-J landed

## Failure modes

- ❌ Genuine new defects on code that happens to be near a prior fix get incorrectly dropped as "contradicting prior advice"
- ❌ Prior recommendations are passed in raw verbatim, allowing prompt-injection via crafted prior suggestion text (sanitisation must already cover this — same `sanitizePreviousFindingString` path used by `buildPreviousFindingsBlock`)
