# E2E-54c: FP-K — abstraction-aware verifier (JSX text)

The W2 verifier prompt's "known-safe abstractions" block includes **React JSX text rendering** (`{x}` interpolation, no `dangerouslySetInnerHTML`) — React auto-escapes HTML, so an "XSS via user.name" finding on plain text interpolation must be dropped as `valid: false`.

The clause covers ONLY plain `{x}` interpolation. `dangerouslySetInnerHTML` is explicitly NOT covered — a finding on that pattern must NOT be dropped.

Pair with `54a-abstraction-drizzle`, `54b-abstraction-encodeuri`, and `54d-abstraction-raw-sql-keep`.

## Apply

```bash
./scripts/apply-fixture.sh 54c-abstraction-jsx-text
```

The overlay adds `src/UserCard.tsx` — a component rendering `{user.name}` and `{user.id}` (no `dangerouslySetInnerHTML`). The model often raises an XSS critical; FP-K must drop it.

## Expected outcomes

- [ ] Verifier drops the "XSS via text content" finding with `[finding-verify] dropped false-positive critical "XSS..." (...): abstraction-safe — React auto-escapes {x} interpolation`
- [ ] **Regression check**: an XSS finding on `dangerouslySetInnerHTML` is NOT dropped (the React JSX clause covers only plain `{x}` text rendering)

## Failure modes

- ❌ Verifier drops an "XSS via dangerouslySetInnerHTML" finding (the React JSX clause should NOT cover `dangerouslySetInnerHTML`)
- ❌ Verifier KEEPS the plain-text XSS finding (FP-K block not applied)
