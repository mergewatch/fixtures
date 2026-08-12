# E2E-66: Self-hosted cost shows when the model is priced (#231)

Per-PR cost (the `Est. cost` line in the review comment's "Review details" drawer) and the dashboard **Cost & Impact** block populate on self-hosted whenever the model is priced. There is **no deployment-mode suppression** — cost was previously blank only because the model wasn't in the pricing table. Three changes:

1. `DEFAULT_PRICING` (`packages/core/src/llm/pricing.ts`) gains the current-gen Anthropic IDs (Sonnet 4.6, Opus 4.8) by **both** Bedrock and direct ID, so direct-Anthropic self-hosters get cost with zero config. Unknown models still return `null`.
2. The `.mergewatch.yml` **`pricing:`** override (model ID → `inputPer1M` / `outputPer1M`, USD per 1M tokens) is now **parsed** by `parseRepoConfigYaml` — it was silently dropped before. Malformed/negative entries are skipped; `0`/`0` records a real **priced $0** (a local model), distinct from an unpriced unknown model.
3. A review on an unpriced model logs a **one-time per-model** `[cost] No pricing for model(s) …` warn pointing at the override, and the dashboard Cost section shows an actionable "set a `pricing:` override" hint instead of a silent $0.

Self-hosted server + Postgres + cost rollup fixture. No fixture PR — reuses any fixture PR that produces a real review (e.g. **E2E-01** or **E2E-03**) and pairs with the **E2E-63** cost seeds.

## Procedure

Self-hosted server with Postgres and the hourly cost rollup enabled.

1. **Priced default** — set `model:` to a priced Anthropic ID (e.g. `claude-sonnet-4-6`). Run a review → the PR comment "Review details" drawer shows an `Est. cost` line. After the hourly rollup, `/dashboard/analytics?tab=cost` shows a non-zero Total spend.
2. **Override** — set `model:` to an unpriced model (an Ollama / LiteLLM ID) and add a matching `pricing:` block in `.mergewatch.yml`:

   ```yaml
   pricing:
     "my-local/llama-3.3-70b":
       inputPer1M: 0.4
       outputPer1M: 0.8
   ```

   Re-review (`@mergewatch review`) → cost appears in the comment and on the dashboard. Add a malformed sibling entry (negative or non-numeric) and confirm it is skipped without breaking the parse.
3. **Local $0** — set the override to `inputPer1M: 0` / `outputPer1M: 0` → "Reviews" reads "all priced" and Total spend is `$0.00`, **not** "unpriced".
4. **Unpriced hint** — remove the `pricing:` entry → the server logs the one-time `[cost]` warn and the dashboard Cost section renders the "this model isn't priced" hint with the `.mergewatch.yml` snippet. Run a second review on the same model and confirm the warn does **not** repeat.
5. **SaaS regression check** — confirm SaaS/Bedrock cost is unchanged and the rollup still excludes unpriced reviews from money totals.

## Expected outcomes

- [ ] Priced model → `Est. cost` in the PR comment **and** non-zero dashboard Total spend, with no config.
- [ ] `.mergewatch.yml` `pricing:` override is parsed and applied (cost appears for an otherwise-unknown model); malformed/negative entries are skipped, not fatal.
- [ ] `0`/`0` counts as priced $0, not unpriced.
- [ ] All-unpriced window → dashboard shows the actionable `pricing:` hint rather than a silent $0; the server logs the `[cost]` warn exactly once per model.
- [ ] SaaS/Bedrock cost unchanged; the rollup still excludes unpriced reviews from money totals while counting their tokens.

## Failure modes

- ❌ Cost still blank on a priced or overridden model.
- ❌ `pricing:` in `.mergewatch.yml` has no effect (still dropped at parse).
- ❌ A `0`/`0` model is reported as "unpriced".
- ❌ The unpriced warn spams every review instead of once per model.
