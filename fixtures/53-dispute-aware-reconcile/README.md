# E2E-53: FP-J L1/L3 — dispute-aware verdict softening + disclosure

The verdict tier now incorporates each org's historical dispute rate per finding category. When the orchestrator wants to BLOCK (score ≤ 2) AND more than half of the action findings come from chronically-disputed categories (rate ≥ 75% AND ≥ 5 surfacings over the 30d FB-E window), the verdict is softened to **3 / Review recommended** (advisory). The finding set is unchanged — only the blocking-tier signal is calibrated against historical accuracy.

A transparent disclosure footer (`📊 N of M action findings are from a category disputed ≥ 75% of the time…`) renders as a quiet sub-line under the merge-score badge whenever at least one action finding's category qualifies — even when the tier didn't change.

Pure deterministic scoring change — no LLM calls, no prompt changes. Reads the latest 30d `InstallationFPInsight` once per review.

Requires pre-seeded FB-A data, so this is a MANUAL_ONLY fixture with a procedure rather than a runner-applied overlay.

## Procedure — two seeding paths

### Direct fixture

Seed an `InstallationFPInsight.perCategory` row where one category (e.g. `style`) has `surfaceCount >= 5` AND `rate >= 0.75`. Then open a PR that draws 3+ warnings, all in that category, with the orchestrator scoring 2.

### Live path

Let FB-A counters accumulate naturally over several weeks of disputes on a single category; the rollup naturally feeds the verdict softener on the next review.

## Expected outcomes

- [ ] **L1 — clamping path**: Red verdict (orchestratorScore = 2) + majority of action findings from a 90%-disputed category → `mergeScore: 3` with reason text mentioning *"historically noisy categories"*
- [ ] **L1 — strict majority**: exactly 50% disputed findings (e.g. 1 of 2) → tier stays at 2 (the clamp requires *strict* majority — 50% isn't enough to override the orchestrator)
- [ ] **L1 — threshold respect**: category rate at 0.5 (below the 0.75 threshold) → no clamp, no disclosure
- [ ] **L1 — back-compat**: absent / empty `categoryDisputeRates` → orchestrator score stands verbatim (identical to pre-FP-J behaviour)
- [ ] **L1 — no upward uplift**: orchestrator score already ≥ 3 → no change to the score (softener only fires on the would-have-been-red path)
- [ ] **L1 — W7 interaction**: W7 unverified-criticals clamp still fires alongside FP-J L1 (both produce `mergeScore: 3`); W7's reason text takes precedence since W7 is checked first
- [ ] **L3 — disclosure renders**: footer appears as `> <sub>📊 …</sub>` beneath the merge-score line whenever at least one action finding qualifies (regardless of whether the tier shifted)
- [ ] **L3 — empty path**: zero action findings → no disclosure (nothing to disclose about)
- [ ] **L3 — ordering**: disclosure renders BELOW the merge-score line, not above
- [ ] **L3 — absent input**: `disputeDisclosure = undefined` → no footer, no `📊` glyph in the comment

## Failure modes

- ❌ Verdict tier downgrades for installations with NO FB-A data yet (the loader's `{}` default regressed; back-compat broken)
- ❌ A single-disputed-finding-on-noisy-category triggers the clamp (strict-majority guard regressed)
- ❌ The disclosure footer renders on a clean / score-5 PR (the disclosure-from-zero-action-findings guard regressed)
- ❌ The disclosure renders above the merge-score line, obscuring the primary verdict
- ❌ A category with `surfaceCount < 5` makes it into the loader's output (small-N noise guard regressed in `loadCategoryDisputeRates`)
- ❌ The clamp triggers when the orchestrator already scored ≥ 3 (the `orchestratorScore <= 2` gate regressed — this would be an unwanted *upward* shift since the W7-shaped clamp only ever should soften a would-be-red verdict)
