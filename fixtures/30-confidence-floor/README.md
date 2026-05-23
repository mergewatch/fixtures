# E2E-30: FP-A — hard confidence-floor filter

Any finding with `confidence < 75` is dropped **deterministically** in code at the top of `runReviewPipeline`, regardless of what the orchestrator returns. Findings with no `confidence` field default to 100 (no surprise suppression of legacy / pre-FP-A stored findings). Constant: `CONFIDENCE_FLOOR = 75` in `packages/core/src/agents/reviewer.ts`.

## Apply

```bash
./scripts/apply-fixture.sh 30-confidence-floor
```

The overlay adds `src/maybe.ts` — designed to draw a low-confidence "consider escaping `q` to avoid pattern injection" finding on the `new RegExp(q)` call (~60 confidence — the threat model is ambiguous).

## Expected outcomes

- [ ] No finding with `confidence < 75` appears in the rendered comment
- [ ] Agent log includes `[confidence-floor] dropped N finding(s) with confidence < 75`
- [ ] `Suppressed N` in the Review details collapsible reflects the drop
- [ ] A finding with `confidence === 75` (boundary) is **kept** — the filter is `< 75`, not `<= 75`
- [ ] A finding with NO `confidence` field is **kept** (defaults to 100)

## Failure modes

- ❌ A finding rendered with `confidence < 75` in the persisted review record
- ❌ A finding without a `confidence` field gets dropped (default-to-100 contract regressed)
- ❌ The drop happens BEFORE the orchestrator runs (would lose the model's dedup signal — the floor must apply to the orchestrator's OUTPUT, not its INPUT)

## Note

Stochastic on a real LLM. To force the suppression deterministically in a self-hosted run, inject `{ ...finding, confidence: 60 }` into the orchestrator response.
