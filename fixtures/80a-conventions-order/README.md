# E2E-80a: Conventions — discovery order, first hit wins

Conventions resolve in a fixed order — `conventions:` in `.mergewatch.yml`, then `AGENTS.md`, `CONVENTIONS.md`, `.mergewatch/conventions.md` — **first hit wins, later candidates are never fetched**. When `conventions:` is set explicitly, only that path is tried, with **no fallback**.

**E2E-27** exercises conventions *content* (W11 scope awareness); this card exercises the *resolution mechanism* itself, which was previously untested. The dangerous failure is the silent one: an author sets `conventions:` to a path with a typo, gets `AGENTS.md` instead, and believes their rules applied.

## Apply

```bash
./scripts/apply-fixture.sh 80a-conventions-order
```

The overlay places a **distinguishable rule in each of the four candidate locations**, then adds `src/conventions-bait.ts`, which violates all four at once — one violation per file:

| Violation | Convention file | Marker | Rank |
|---|---|---|---|
| `var` | `AGENTS.md` | `MARKER-AGENTS` | #2 |
| `==` | `CONVENTIONS.md` | `MARKER-CONVENTIONS` | #3 |
| `any` | `.mergewatch/conventions.md` | `MARKER-DOTDIR` | #4 |
| `console.log` | `docs/house-rules.md` | `MARKER-HOUSE` | explicit-only |

**Which rule the review cites is a direct readout of which file resolved** — no log inspection required. Walk down the chain by deleting files on the branch and pushing between steps:

1. As applied (no `conventions:` key) → only the **`var`** rule is cited.
2. Delete `AGENTS.md`, push → only the **`==`** rule is cited.
3. Delete `CONVENTIONS.md`, push → only the **`any`** rule is cited.
4. Add `conventions: docs/house-rules.md` to `.mergewatch.yml`, push → only the **`console.log`** rule is cited, beating everything still present.
5. Set `conventions:` to a **missing** path (e.g. `docs/nope.md`), push → **no** conventions are injected, and discovery does **not** silently fall back to `AGENTS.md`.
6. Delete all four candidate files, push → the review runs normally with no conventions.

## Expected outcomes

- [ ] With no `conventions:` key, `AGENTS.md` wins — only the `var` rule is cited, never the other three markers.
- [ ] Deleting each winner promotes exactly the next candidate, in the documented order.
- [ ] An explicit `conventions:` path beats every auto-discovered candidate.
- [ ] An explicit `conventions:` path that **misses** injects nothing and never falls back.
- [ ] Multiple candidates are **not** concatenated — exactly one marker's rule is ever in play.
- [ ] The review names which file was used (`sourcePath`), so authors can tell which rules applied.
- [ ] A repo with no conventions file at all reviews normally.

## Failure modes

- ❌ A missing explicit `conventions:` path silently falls back to `AGENTS.md` — the author believes their rules applied when they did not.
- ❌ Multiple candidates are concatenated instead of first-hit-wins (the tell: two or more marker rules cited in one review).
- ❌ A lower-ranked candidate wins while a higher one exists.
- ❌ The review never surfaces `sourcePath`, leaving resolution unverifiable from the PR.
