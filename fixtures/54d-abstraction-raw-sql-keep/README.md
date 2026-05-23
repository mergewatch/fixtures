# E2E-54d: FP-K — regression guard (raw SQL concat must KEEP the finding)

The fourth quadrant of FP-K: a **regression guard** verifying the abstraction-aware verifier does NOT over-suppress on raw string-concat SQL. The cited line is `\`SELECT * FROM users WHERE id = '${id}'\`` — no ORM, no parameterization, no abstraction in sight. The FP-K prompt's fail-safe rule biases toward `valid: true` when no listed abstraction is unambiguously present on the cited path.

Pair with `54a-abstraction-drizzle`, `54b-abstraction-encodeuri`, `54c-abstraction-jsx-text`.

## Apply

```bash
./scripts/apply-fixture.sh 54d-abstraction-raw-sql-keep
```

The overlay adds `src/raw-query.ts` — raw string-concat SQL with no abstraction. The verifier must KEEP the SQL-injection critical.

## Expected outcomes

- [ ] Verifier KEEPS the "SQL injection on raw concat" critical (the FP-K abstraction prefix is absent on the cited path → the model returns `valid: true`)
- [ ] Verdict reflects the critical (orange / red, REQUEST_CHANGES or COMMENTED-with-W7-clamp)
- [ ] **Fail-safe**: when the abstraction is ambiguous (e.g. a method call that COULD be ORM or COULD be raw SQL), the verifier returns VALID by default

## Failure modes

- ❌ Verifier drops the raw-concat SQL injection finding (the FP-K block's fail-safe / unambiguous-abstraction-required guard regressed; the model is incorrectly over-applying the abstraction-safe rule)
- ❌ The model over-suppresses on infrastructure-shaped ambiguous data flows (`store.query(input)` where the store's internal sanitization isn't visible from the cited file) — the fail-safe rule should bias toward VALID
