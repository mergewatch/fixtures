# E2E-81: Codebase awareness — file-request budget

With `codebaseAwareness: true`, agents may request files beyond the diff for cross-file context, bounded by `maxFileRequestRounds` (1–2) and `maxContextKB`. The budget exists so a curious agent cannot pull an unbounded amount of the repository into the prompt — and so hitting the ceiling degrades gracefully instead of failing the review.

The sharper property is the *off* case: with awareness disabled, an agent must **say it cannot see** the out-of-diff file rather than fabricate its contents. That is the exact hallucination class grounding (**E2E-17**) and diagram-path validation (**E2E-33**) exist to prevent, reached from a different direction.

## Apply

```bash
./scripts/apply-fixture.sh 81-file-request-budget
```

The overlay changes `src/app.ts` only. Its correctness is decidable **only** by reading `src/utils.ts` — which is part of the baseline and therefore **not in this PR's diff**:

- `multiply(a, b)` is declared in `utils.ts` as returning a `number`, so `scaled.padStart(8, ' ')` is a type error — nothing in `app.ts` reveals that.
- `add(a, b)` takes exactly two arguments; the three-argument call is wrong for the same out-of-diff reason.

This is the cleanest available shape for the card: the baseline already contains `utils.ts`, so the dependency is genuinely outside the diff rather than manufactured.

Then walk the budget, pushing between steps:

1. As applied (`codebaseAwareness: true`, `maxFileRequestRounds: 1`) → `utils.ts` is fetched and the findings cite its **real** signatures.
2. Set `codebaseAwareness: false`, push → the agent either says it cannot see `utils.ts` or omits the claim. It must **not** describe contents it never fetched.
3. Set `maxContextKB` very low (e.g. `1`), push → fetching stops at the budget and the review still completes, with a **partial-context note** rather than a failure.
4. Set `maxFileRequestRounds: 2`, push → a second round is allowed; confirm a **third** is never attempted.

## Expected outcomes

- [ ] With awareness **off**, agents do not invent the contents of unfetched files — no confident claim about `multiply`'s return type or `add`'s arity.
- [ ] With awareness **on**, `src/utils.ts` is fetched and the findings reflect its real contents (the `padStart`-on-a-number and arity errors are caught and correctly attributed).
- [ ] `maxFileRequestRounds` is enforced — round 2 allowed only when configured, round 3 never attempted.
- [ ] `maxContextKB` is enforced — fetching stops at the budget.
- [ ] Hitting the budget degrades gracefully: partial context, completed review, and a note saying context was partial.
- [ ] The fetched-file list is visible enough to confirm *what* was pulled in.

## Failure modes

- ❌ An agent describes a file it never fetched — hallucinated context, the exact failure grounding exists to prevent.
- ❌ The budget is exceeded, inflating cost on large repos.
- ❌ Hitting the cap fails the review instead of degrading to partial context.
- ❌ Awareness is on but the out-of-diff file is never fetched, so the type error goes unnoticed (the feature is inert).
