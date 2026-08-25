# E2E-71: MCP — API key scope enforcement and revocation

Every MCP request authenticates with `Authorization: Bearer mw_sk_…`. Keys are created in the dashboard (**Settings → API keys**) by **installation admins only**, are stored hashed (the raw value is returned exactly once at creation), and carry a scope of either `all` or an explicit `owner/repo` allowlist. A scoped key operating outside its list is rejected. `lastUsedAt` updates on each authenticated request.

This is the authentication boundary for the whole MCP surface — **E2E-69**, **E2E-70**, and **E2E-72** all depend on a key minted here. Dashboard + API fixture, no fixture PR.

## Procedure

1. **Admin-only** — as a non-admin member, `POST /api/api-keys` → **403**. As an admin → **200** with a `raw` key.
2. **Shown once** — re-list keys → only a display prefix (`mw_sk_…<hash8>`), never the raw value.
3. **Validation** — create with an empty label → 400; a label > 100 chars → 400; `scope: []` → 400 ("Select at least one repo").
4. **Scope enforcement** — create a key scoped to repo B only. Call `review_diff` with `repo: <owner>/A` → **`-32001`**. With repo B → succeeds. Repeat for `resources/read` on repo A's conventions → `-32001`.
5. **Missing / malformed auth** — no `Authorization` header → `-32001`; `Authorization: token abc` (not `Bearer`) → `-32001`.
6. **Revocation** — revoke the key and immediately retry → `-32001` on the very next request, with no grace period. Confirm a non-admin cannot revoke (403).
7. **lastUsedAt** — confirm it advances after a successful call.

## Expected outcomes

- [ ] Non-admins cannot create or revoke keys (403).
- [ ] The raw key appears exactly once; only a hash-derived prefix is listed afterwards.
- [ ] Scoped keys are rejected for out-of-scope repos with `-32001`, on tools **and** resources.
- [ ] Missing/malformed `Authorization` → `-32001`, never a 500 or a stack trace.
- [ ] Revocation takes effect on the next request.
- [ ] `lastUsedAt` updates on authenticated use.

## Failure modes

- ❌ A revoked key keeps working until a cache expires.
- ❌ An out-of-scope `repo` is silently ignored and the review runs unscoped.
- ❌ Any response echoes the raw key or its hash.
- ❌ A scoped key can read another repo's conventions via `resources/read`.

## How to verify locally

`MANUAL_ONLY` — `grade-run.mjs` reads GitHub PR state, and this fixture asserts
on an MCP endpoint. See [`e2e/MANUAL-VERIFICATION.md`](../../e2e/MANUAL-VERIFICATION.md).

Call with a key scoped to a different installation and assert it is refused — this one is a security boundary, so a pass means the *refusal* was observed, not merely that nothing broke.

Record what you checked. A graded run reports this fixture as **NOT VERIFIED**,
and an unrecorded manual pass is indistinguishable from one that never
happened.
