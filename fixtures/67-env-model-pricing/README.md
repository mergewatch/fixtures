# E2E-67: Global env pricing for the LLM_MODEL (#233)

Self-hosted operators usually set the review model globally with the `LLM_MODEL` env var, which overrides `model` + `lightModel` for every repo (`review-processor.ts`). When that value is a model MergeWatch can't price by ID — most notably a **Bedrock application-inference-profile ARN** — two env vars price it globally, with no per-repo `.mergewatch.yml`:

```bash
LLM_MODEL=arn:aws:bedrock:us-west-2:…:application-inference-profile/abc123
LLM_MODEL_INPUT_PRICE_PER_1M=5
LLM_MODEL_OUTPUT_PRICE_PER_1M=25
```

The env price becomes a `customPricing` entry keyed to the `LLM_MODEL` value and is applied to **both** the full review pipeline and the **inline-reply** cost — the inline path previously ignored custom pricing entirely. Precedence: a per-repo `.mergewatch.yml` `pricing:` entry for the same model **overrides** the env price. `0`/`0` records a real priced `$0` (local model). If `LLM_MODEL` is set but the price vars are partial or invalid (only one set, non-numeric, negative), they are ignored with a **one-time** `[cost]` warn rather than silently reading as $0.

Self-hosted server fixture, `LLM_PROVIDER=bedrock`. No fixture PR — reuses any fixture PR that produces a real review (e.g. **E2E-01**) plus an inline thread from **E2E-13**. Pairs with **E2E-66**.

## Procedure

1. **Before** — with `LLM_MODEL` set to the ARN and no price vars, run a review → the "Review details" drawer shows tokens but **no** `Est. cost`; the dashboard Cost section lists the ARN as unpriced.
2. **Env price** — set `LLM_MODEL_INPUT_PRICE_PER_1M=5` and `LLM_MODEL_OUTPUT_PRICE_PER_1M=25`, restart, re-review with `@mergewatch review` → the comment now shows an `Est. cost` line. After the hourly rollup, `/dashboard/analytics?tab=cost` shows non-zero spend.
3. **Inline reply** — reply in a MergeWatch inline thread (E2E-13) → the rolled-up PR cost **increases**; the inline reply is priced too.
4. **Override** — add a `pricing:` block for the same ARN in a repo's `.mergewatch.yml` with different numbers → that repo uses the per-repo price, not the env one.
5. **Local $0** — set both env vars to `0` → "Reviews" reads "all priced" and Total spend is `$0.00`, not "unpriced".
6. **Partial / invalid** — set only the input var, or a non-numeric / negative value → exactly one `[cost] … must both be set …` warn in the server log; cost stays unpriced rather than reading as $0.

## Expected outcomes

- [ ] `LLM_MODEL_*_PRICE_PER_1M` makes per-PR `Est. cost` and dashboard cost appear for the `LLM_MODEL` (including an ARN) with no `.mergewatch.yml` change.
- [ ] **Both** full-review and inline-reply costs are priced.
- [ ] A per-repo `.mergewatch.yml` `pricing:` entry overrides the env price for the same model.
- [ ] `0`/`0` → priced $0; partial/invalid → one-time warn and ignored.
- [ ] Unset price vars → no change in behavior; SaaS/Bedrock unchanged.

## Failure modes

- ❌ Cost still blank after setting both price vars.
- ❌ Inline replies stay unpriced while full reviews are priced.
- ❌ The env price wins over a per-repo `pricing:` entry for the same model.
- ❌ A partial/invalid value reads as $0 with no warning, or the warn spams every review.

## How to verify locally

`MANUAL_ONLY` — `grade-run.mjs` reads GitHub PR state, and this fixture asserts
on a rendered dashboard page. See [`e2e/MANUAL-VERIFICATION.md`](../../e2e/MANUAL-VERIFICATION.md).

Read the page. Where a number is the real assertion, prefer the API beneath it over the pixels.

Record what you checked. A graded run reports this fixture as **NOT VERIFIED**,
and an unrecorded manual pass is indistinguishable from one that never
happened.
