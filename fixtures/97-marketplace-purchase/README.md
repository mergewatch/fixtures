# E2E-97 — #421: Marketplace purchase recorded and attached

`MANUAL_ONLY`. Not a PR fixture and not automatable in the suite, for two
reasons worth stating rather than leaving implicit:

1. **It needs an external prerequisite the suite cannot create** — the
   Marketplace listing's *Manage webhook* pointed at the stage's `WebhookUrl`,
   content type `application/json`, secret from SSM
   `/mergewatch/{stage}/github-webhook-secret`. That is GitHub listing
   configuration, not repository state.
2. **Its assertions live in DynamoDB**, not on a pull request. `grade-run.mjs`
   reads GitHub, so there is nothing here it can grade — the same limitation
   that keeps the other billing fixtures manual (#443).

## Procedure

1. Send `marketplace_purchase.purchased` from the listing's delivery log.
2. Install the App on the purchasing account.
3. Redeliver the original purchase.
4. Send `cancelled`.

## Expected outcomes

- [ ] `purchased` returns 200 and logs `[marketplace] purchased recorded for <account> (id=…, plan=…)`
- [ ] One row at PK `#MARKETPLACE`, SK = **lowercased** login, carrying `accountId`, `planName`, `purchasedAt`
- [ ] After `installation.created`, the installation's `#SETTINGS` row carries `marketplaceAccountLogin` / `marketplaceAccountId` / `marketplacePlanName` / `marketplaceAttachedAt`, and the `#MARKETPLACE` row carries `attachedInstallationId`
- [ ] **Redelivery is idempotent** — still exactly one row, and `purchasedAt` is **unchanged**. This is the conditional-write path; a redelivery that moves `purchasedAt` would silently rewrite attribution history
- [ ] `cancelled` sets `cancelledAt` and logs `— recorded only, nothing revoked`; the installation's OSS grant, balance and `freeReviewsUsed` are all untouched

## Failure modes

- ❌ A redelivery creates a second row or moves `purchasedAt` — the conditional write is not guarding
- ❌ `cancelled` revokes anything — recording attribution and controlling entitlement are separate concerns, deliberately
- ❌ The SK is not lowercased — attribution silently misses on a differently-cased login

## Why no `expect.json`

There is nothing on a PR to grade. Adding one would make the fixture report
`UNGRADED`, which `grade-run.mjs` exits 0 on — a fixture that looks graded and
can never fail. That is the pattern #447 exists to eliminate, so it is left
off deliberately.

## How to verify locally

`MANUAL_ONLY` — `grade-run.mjs` reads GitHub, and this fixture asserts on
DynamoDB. See [`e2e/MANUAL-VERIFICATION.md`](../../e2e/MANUAL-VERIFICATION.md)
for the session check and the command shapes.

- **Table** — `mergewatch-installations-dev` (the **dev** stage, never prod)
- **Key** — pk `'#MARKETPLACE'` · sk = lowercased account login
- **Look at** — `accountId`, `planName`, `purchasedAt`, and later `attachedInstallationId`

Record what you checked. A graded run reports this fixture as **NOT VERIFIED**,
and an unrecorded manual pass is indistinguishable from one that never
happened.
