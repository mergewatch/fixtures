# E2E-23: Re-review convergence — no whack-a-mole (W9+W3)

Across commits, the same underlying concern must keep a stable identity and a rebutted finding must not be regenerated. Specifically:
- **(a) W9** — no finding appears as both **✅ Resolved** and **🆕 new** in the same review comment (`computeReviewDelta` union-matches on code fingerprint OR title).
- **(b) W3** — a finding the author rebutted in a `## mergewatch triage` reply on a prior commit is **not** re-raised under a drifted title/line on the next commit (`computeDisputedKeys` + `partitionDisputed`, fail-open).

Live evidence this card defends: **PR #145 round 2** reported `:1207 "Catch-and-continue pattern…"` as 🆕 new while the same code (`:1225 "Broad exception catching…"`) was listed ✅ Resolved in the same comment.

## Apply

```bash
./scripts/apply-fixture.sh 23-convergence
```

Branch: `fixture/23-convergence`. The overlay adds `src/swallow.ts` with a broad `catch {}` that reliably draws one stable warning.

## Step 2 — triage + line shift (manual)

After the first review lands and notes the broad-catch warning, post a top-level PR comment **as the PR author**:

```
## mergewatch triage

⚠️ "Broad catch swallows error" — by design. The catch-all is the
intentional fail-safe; logging added below.
```

Then push a small commit that adds a log line above the `catch` (shifting subsequent line numbers):

```bash
# Edit src/swallow.ts: add `  console.log('[tryLoad] attempting…');` as the
# first line inside `tryLoad` (before the `try`). This shifts the catch
# block down by one line.
git add src/swallow.ts && git commit -m 'log: announce tryLoad attempts' && git push
```

## Expected outcomes (re-review)

- [ ] **(a) W9** "📎 Previously reported" does **not** list the same concern under both ✅ Resolved and 🆕 new (the catch is matched by fingerprint despite line shift / reworded title)
- [ ] **(b) W3** The rebutted finding is **suppressed** — not re-raised as 🆕 new under a reworded title. Agent log shows a `[triage-suppressed]` line; `Suppressed N` incremented.
- [ ] **(a) W9** `🆕 new` counts only genuinely new concerns introduced by the step-2 diff (line drift alone produces zero "new")
- [ ] **(b) W3** Verdict converges across commits once rebutted findings stop regenerating

## Regression check — code-anchored rebuttal (optional step 3)

Push a third commit that *materially* rewrites the rebutted code (e.g. replace the bare `catch` with `catch (err) { logger.error(err); throw err; }`). The next review **should resurface** the catch finding — rebuttals are code-anchored, not permanent.

## Failure modes

- ❌ Same finding simultaneously ✅ Resolved and 🆕 new (W9 regressed — `review-delta.test.ts` should also fail)
- ❌ A `mergewatch triage`-rebutted finding reappears verbatim-in-substance at a new line (W3 regressed — `triage.test.ts` should also fail)
- ❌ Over-suppression: rebutted-then-rewritten code does NOT resurface (the code-anchored fingerprint regressed)

## Note

Both halves are real regression guards (unit-locked in `review-delta.test.ts` and `triage.test.ts`). The remaining manual step is the over-suppression regression check — automate it if it proves flaky.
