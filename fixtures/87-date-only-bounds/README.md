# E2E-87: #337 — Date-only range bounds include their whole day

The stores filter `createdAt` by string comparison against full ISO timestamps,
so a date-only bound used to misbehave at one edge
(`'2026-08-16T09:31:00.000Z' <= '2026-08-16'` is false → the entire final day
silently excluded). `/api/analytics` now normalizes at the boundary: date-only
`start_date` expands to `T00:00:00.000Z`, date-only `end_date` to
`T23:59:59.999Z`; full timestamps pass through untouched (the dashboard UI sends
exact viewer-local-derived instants that must not be re-widened). Both backends
receive the same expanded instants — identical by construction. Timezone
decision documented in the route: date-only params and trend-bucket labels are
UTC calendar days; viewer-zone bucketing deliberately deferred until edge-day
attribution matters. Shipped in #337 (PR #347).

API-inspection fixture, no fixture PR.

## Procedure

1. Seed reviews across three consecutive days, including one mid-morning on the
   last day. Call `/api/analytics?end_date=<last-day>` (date-only): the last
   day's reviews are included in totals and trends.
2. Same call with `end_date=<last-day>T00:00:00.000Z`: last day excluded except
   midnight — full timestamps are honored verbatim.
3. `start_date=<first-day>` date-only: the whole first day is included.
4. Repeat 1 on self-hosted (Postgres): identical totals.

## Expected outcomes

- [ ] Date-only `end_date` includes the whole final day; date-only `start_date`
      the whole first day
- [ ] Full-timestamp bounds honored exactly, never re-widened
- [ ] Postgres and DynamoDB return identical results for the same parameters
- [ ] Invalid date forms are ignored (no 500, no partial filter)
