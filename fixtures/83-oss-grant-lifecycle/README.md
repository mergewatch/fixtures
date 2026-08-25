# E2E-83: OSS Program — operator grant lifecycle

`scripts/grant-oss.ts` is the **only** way a grant is written. It resolves a repo
to its installation via an App JWT, verifies the repo is public, shows the blast
radius, and refuses to run without an explicit `--stage`. Shipped in #266.

Operator CLI fixture — no PR, no overlay; run from the upstream repo checkout.

## Procedure

1. `scripts/grant-oss.ts <owner>/<repo>` with no `--stage` → confirm it refuses
   rather than defaulting to prod.
2. `--inspect` on an ungranted repo → confirm it reports no grant.
3. Grant with `--stage dev --cap 500 --months 1`; confirm the confirmation prompt
   lists the covered repo **and** the installation's other repos that are *not*
   covered.
4. `--inspect` again → confirm cap, expiry, `ossGrantedAt`, and `ossGrantNote`
   render back.
5. `--add` a second repo, then `--remove` it; confirm the list changes and
   nothing else does.
6. Attempt to grant a **private** repo → confirm it refuses.
7. `--revoke`; confirm expiry moves to the past and `--inspect` reports it
   inactive.

## Expected outcomes

- [ ] Refuses to run without `--stage`.
- [ ] Private repo is rejected at grant time.
- [ ] Blast radius lists both covered and uncovered repos before writing.
- [ ] `--add` / `--remove` mutate only the repo list.
- [ ] `--inspect` renders provenance (`ossGrantedAt`, `ossGrantNote`) for
      auditing months later.
- [ ] `--revoke` leaves the install on the standard gate, not blocked.

## Failure modes

- ❌ Runs against prod without an explicit stage.
- ❌ Grants a private repo.
- ❌ Writes without showing what it will cover.

## How to verify locally

`MANUAL_ONLY` — `grade-run.mjs` reads GitHub, and this fixture asserts on
DynamoDB. See [`e2e/MANUAL-VERIFICATION.md`](../../e2e/MANUAL-VERIFICATION.md)
for the session check and the command shapes.

- **Table** — `mergewatch-installations-dev` (the **dev** stage, never prod)
- **Key** — pk `installationId` · sk `#SETTINGS`
- **Look at** — the `ossGrant*` fields across grant, expiry and revoke

Record what you checked. A graded run reports this fixture as **NOT VERIFIED**,
and an unrecorded manual pass is indistinguishable from one that never
happened.
