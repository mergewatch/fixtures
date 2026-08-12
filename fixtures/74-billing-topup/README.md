# E2E-74: Billing — top-up and auto-reload

Credits are prepaid via Stripe. **Auto-reload** tops the balance up when it drops below a threshold, guarded by a conditional write on `autoReloadInFlight` so concurrent reviews cannot double-charge.

Billing fixture, no fixture PR of its own — drive it with ordinary fixture PRs (**E2E-01** / **E2E-03**) on a SaaS installation with a Stripe **test** payment method. Pairs with **E2E-73**, which covers the block path when no credits exist.

## Procedure

1. **Manual top-up** — add credits → the balance increases, a Stripe charge is recorded, and **no** subscription is created.
2. **Auto-reload off (default)** — confirm the setting is off out of the box. Drain the balance below the minimum → reviews block per **E2E-73**, and **no** charge occurs.
3. **Auto-reload on** — enable it, drain the balance → a top-up fires automatically and reviews continue uninterrupted.
4. **Concurrency** — with the balance sitting just below the threshold, trigger several reviews simultaneously (apply a few fixtures back-to-back with `SLEEP=0`) → **exactly one** top-up charge, not one per review.
5. **Failure path** — swap in a card that declines, drain the balance → the failure surfaces and reviews block rather than running unpaid.

## Expected outcomes

- [ ] Manual top-up increases the balance and creates no recurring subscription.
- [ ] Auto-reload is off unless explicitly enabled.
- [ ] With auto-reload on, a drained balance self-heals without blocking a review.
- [ ] Concurrent drops below the threshold produce exactly one charge (the mutex holds).
- [ ] A declined card blocks reviews and surfaces the failure.

## Failure modes

- ❌ Two simultaneous reviews each trigger a top-up (the `autoReloadInFlight` guard is not holding).
- ❌ Auto-reload charges when disabled.
- ❌ A declined auto-reload lets reviews run unpaid.
