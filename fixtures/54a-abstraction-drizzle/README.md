# E2E-54a: FP-K — abstraction-aware verifier (Drizzle eq)

The W2 verifier prompt now carries a static "known-safe abstractions" block listing six concrete patterns where a generic injection / XSS / overflow finding is unambiguously neutralised by the surrounding code. **Drizzle's `eq()` / `and()` / `or()` / `inArray()` query builders** parameterize all values — so a "SQL injection on Drizzle `eq()` call" finding must be dropped as `valid: false` by the verifier.

The block ends with a **fail-safe rule**: *"If you cannot tell from the file content whether the cited code path goes through one of these abstractions, treat the finding as VALID by default."* — the verifier only drops findings when the abstraction is unambiguously present on the cited path.

Pair with `54b-abstraction-encodeuri`, `54c-abstraction-jsx-text`, and `54d-abstraction-raw-sql-keep` (the regression guard).

## Apply

```bash
./scripts/apply-fixture.sh 54a-abstraction-drizzle
```

The overlay adds `src/installations.ts` — queries a URL-parameter `installationId` via `eq(installations.installationId, installationId)`. The model often raises "SQL injection via unvalidated installationId" here; FP-K must drop it.

## Expected outcomes

- [ ] Verifier drops the "SQL injection on Drizzle eq()" finding with `[finding-verify] dropped false-positive critical "SQL injection..." (...): abstraction-safe — Drizzle eq() parameterizes the value`
- [ ] **Prompt-shape**: the FP-K block renders on FIRST reviews (`previousFindings` empty) — independent of the FP-H/J prior-context placeholder
- [ ] **Ordering**: FP-K block renders BEFORE the prior-context block on re-reviews (verifier reads abstraction guards before anti-anchoring guards)
- [ ] **Back-compat**: a finding on info-only severity is NOT verified (info-level findings skip W2 entirely)

## Failure modes

- ❌ Verifier KEEPS the Drizzle-eq finding (FP-K block not rendered, or model isn't applying the rule)
- ❌ Verifier drops a "SQL injection" finding on RAW string-concat SQL in a different fixture (over-application; see `54d-abstraction-raw-sql-keep`)
