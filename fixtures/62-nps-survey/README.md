# E2E-62: Engagement — dashboard NPS survey (engagement metrics, stage 5)

`/dashboard/analytics` shows a throttled NPS prompt ("How likely are you to recommend MergeWatch?", 0–10). `GET /api/nps?installation_id=…` returns `{ eligible }` — true only when a satisfaction store is wired AND this `githubUserId` has no response in the last 90 days. `POST /api/nps` records (latest-wins) `{ installation_id, score }` after verifying installation access. The hourly rollup computes `engagement.npsScore` = %promoters (9–10) − %detractors (0–6) over in-window responses (integer −100..100; `null` when none), and the dashboard renders an **NPS** StatCard. A per-browser dismissal (sessionStorage) hides a dismissed prompt for the session.

Dashboard-interaction fixture, no fixture PR. Shipped in #210.

## Procedure

Branch: `fixture/62-nps-survey`. As an admin who hasn't responded in 90d, open `/dashboard/analytics?org=<installationId>` → the NPS prompt appears. Click a score; confirm the thank-you and that `GET /api/nps` now returns `{ eligible: false }`. Inspect the satisfaction store (`NPS#<githubUserId>` item / `nps_responses` row). Trigger the hourly rollup and confirm the NPS StatCard.

## Expected outcomes

- [ ] The NPS prompt shows for an eligible admin; the 0–10 scale records on click.
- [ ] After responding, `GET /api/nps` reports `eligible: false` (90-day throttle per `githubUserId`).
- [ ] `POST /api/nps` rejects an out-of-range score (must be integer 0–10) and an unauthorized installation.
- [ ] The rollup computes `npsScore` = %promoters − %detractors; the dashboard renders the NPS StatCard (`—` when no responses).
- [ ] No satisfaction table provisioned → `GET /api/nps` returns `eligible: false` (never prompts).

## Failure modes

- ❌ The prompt re-appears for an admin who already responded within 90 days.
- ❌ NPS counts passives (7–8) as promoters or detractors.
- ❌ The route records a response without verifying installation access.
