# E2E-72: MCP — session billing dedup (30-minute window)

Coding agents iterate, so repeated `review_diff` calls carrying the same `sessionId` collapse into one billing session. Within a **30-minute** window each call is billed only the **positive delta** above the highest cost billed so far, and the session's iteration counter increments. Without this, an agent that reviews a diff five times pays five times.

Billing fixture on the MCP surface, no fixture PR. Needs a key from **E2E-71**, the `review_diff` call shape from **E2E-69**, and a **paid** (non-free-tier) installation so charges are visible — see **E2E-73** for the free-tier boundary.

## Procedure

1. Call `review_diff` with `sessionId: <uuid>` on a small diff. Record the charge and the resulting balance.
2. Call again with the **same** `sessionId` and the **same** diff → charge is **0** (already covered by the session max); the iteration counter increments to 2.
3. Call again with the same `sessionId` and a **larger** diff whose cost exceeds the session max → charged only the **difference**, not the full amount.
4. Call again with the same `sessionId` and a **cheaper** diff → charge is 0; no negative charge or refund.
5. Call with a **new** `sessionId` → charged in full.
6. Fire two calls concurrently on one `sessionId` → the session max is updated under a guard; the pair does not both bill in full.
7. Wait out the 30-minute window, reuse the original `sessionId` → charged in full again (window expired).
8. Omit `sessionId` entirely → every call charged in full, with no error.

## Expected outcomes

- [ ] Repeat calls in one session with no cost increase are billed 0.
- [ ] A costlier call in an open session is billed only the delta.
- [ ] A new `sessionId` starts a fresh session billed in full.
- [ ] The window expires at 30 minutes and billing resets.
- [ ] Omitting `sessionId` disables dedup rather than erroring.
- [ ] The iteration counter reflects the true number of calls.

## Failure modes

- ❌ Every iteration is billed in full (dedup not applied) — makes the tool too expensive to iterate with.
- ❌ A **cheaper** later call produces a negative charge or a refund.
- ❌ Two concurrent calls on one `sessionId` both bill in full (race on the session max).
- ❌ A `sessionId` supplied by one installation affects another's billing.

## How to verify locally

`MANUAL_ONLY` — `grade-run.mjs` reads GitHub PR state, and this fixture asserts
on an MCP endpoint plus the sessions table. See [`e2e/MANUAL-VERIFICATION.md`](../../e2e/MANUAL-VERIFICATION.md).

Call twice inside the dedup window and assert one billable session, not two.

Record what you checked. A graded run reports this fixture as **NOT VERIFIED**,
and an unrecorded manual pass is indistinguishable from one that never
happened.
