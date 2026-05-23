# E2E-54b: FP-K — abstraction-aware verifier (encodeURIComponent)

The W2 verifier prompt's "known-safe abstractions" block includes `encodeURIComponent` on URL construction — it encodes every special character, so a "URL injection via unvalidated input" finding on `fetch(\`/api/foo?id=${encodeURIComponent(id)}\`)` must be dropped as `valid: false`.

Pair with `54a-abstraction-drizzle`, `54c-abstraction-jsx-text`, and `54d-abstraction-raw-sql-keep`.

## Apply

```bash
./scripts/apply-fixture.sh 54b-abstraction-encodeuri
```

The overlay adds `src/api-fetch.ts` — `fetch(\`/api/foo?id=${encodeURIComponent(id)}\`)`. The model often raises a URL-injection critical; FP-K must drop it.

## Expected outcomes

- [ ] Verifier drops the "URL injection on encodeURIComponent" finding with `[finding-verify] dropped false-positive critical "URL injection..." (...): abstraction-safe — encodeURIComponent encodes every special character`
- [ ] FP-K block renders on FIRST reviews independent of `previousFindings`

## Failure modes

- ❌ Verifier KEEPS the encodeURIComponent finding (FP-K block not applied)
- ❌ Verifier drops a URL-construction finding on RAW string interpolation without encodeURIComponent (over-application)
