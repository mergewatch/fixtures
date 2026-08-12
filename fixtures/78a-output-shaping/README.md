# E2E-78a: Output shaping — `minSeverity` and `maxFindings`

Two independent knobs on what reaches the PR. `minSeverity` (`info` | `warning` | `critical`) drops lower-severity findings, with the named tier **inclusive**. `maxFindings` caps how many are posted — and must cap **by rank**, keeping the most severe, with the truncation **disclosed** rather than silent. A reader who is shown 3 of 9 findings and told nothing believes they have seen everything.

## Apply

```bash
./scripts/apply-fixture.sh 78a-output-shaping
```

The overlay adds `src/mixed-severity.ts`, engineered to produce findings in all three tiers — criticals (hardcoded credential, SQL injection), warnings (unawaited promise in a loop, unvalidated external JSON, missing error handling), and info (dead local, redundant intermediate). The config starts at `minSeverity: warning` + `maxFindings: 3`.

**The criticals are defined last in the file on purpose.** If `maxFindings` truncates by discovery order instead of by rank, the criticals are exactly what gets dropped — the failure this fixture is shaped to expose.

Walk the ladder by editing `.mergewatch.yml` on the branch and pushing between each step (each push triggers a re-review):

1. `minSeverity: info` (default — comment the line out) → all three tiers appear.
2. `minSeverity: warning` → info findings gone; warnings and criticals remain.
3. `minSeverity: critical` → only criticals; confirm the merge score is still shown.
4. `maxFindings: 3` against the unfiltered run → exactly 3 posted, and they are the highest-ranked.

Diff the posted findings between steps rather than judging each run in isolation — the tier boundaries are only meaningful as a comparison.

## Expected outcomes

- [ ] `minSeverity: info` → info, warning, and critical findings all appear.
- [ ] `minSeverity: warning` → info findings are gone; warnings **and** criticals remain (boundary tier inclusive).
- [ ] `minSeverity: critical` → only criticals; the merge score and verdict still render.
- [ ] `maxFindings: 3` posts exactly 3, and they are the **top-ranked** — the criticals survive despite being discovered last.
- [ ] Truncation is **disclosed** — the comment tells the reader findings were withheld and how many.
- [ ] The two knobs compose: filtering by severity first, then capping the remainder.

## Failure modes

- ❌ `maxFindings` keeps arbitrary (first-found) findings rather than the top-ranked ones — the tell is criticals missing while info findings are shown.
- ❌ Truncation is silent, so a reader believes they have seen everything.
- ❌ `minSeverity: critical` also hides the merge score.
- ❌ The boundary tier is exclusive (`minSeverity: warning` drops warnings too).
