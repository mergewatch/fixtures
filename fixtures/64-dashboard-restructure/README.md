# E2E-64: Dashboard restructure — Analytics (value) + Accuracy (correctness), hourly rollup (#218)

The dashboard splits by intent. **`/dashboard/analytics`** shows **Activity** (reviews, findings, severity, categories) **plus an Impact panel** (cycle-time, LLM cost, developer engagement + NPS) fetched from `/api/insights`. The former "FP Insights" page is renamed **Accuracy** at **`/dashboard/accuracy`** (nav: "Accuracy") and carries only the false-positive surface (funnel, dispute-rate-by-agent, severity-shopping, recurring themes, per-repo heatmap). The old **`/dashboard/insights`** path **308-redirects** to `/dashboard/accuracy` (query params preserved). The insight rollup runs **hourly** in both runtimes — SaaS EventBridge `cron(0 * * * ? *)`, self-hosted `setInterval` configurable via `INSIGHTS_ROLLUP_INTERVAL_MINUTES` (default 60). Internal identifiers (`InstallationFPInsight`, `/api/insights`, the `fp-insights` tables) are unchanged.

Dashboard-inspection fixture; reuses any installation with rollup data (**E2E-56 / 59 / 63** seeds). No fixture PR.

## Procedure

1. Open `/dashboard/analytics?org=<id>` — confirm the Activity charts **and** the Impact panel (Cost / Cycle time / Developer engagement) render below them, with their own 7d / 30d / 90d selector.
2. Open `/dashboard/accuracy?org=<id>` — nav item reads "Accuracy"; page shows only false-positive sections (no cost / cycle / engagement).
3. Visit `/dashboard/insights?org=<id>` — confirm the 308 redirect to `/dashboard/accuracy?org=<id>` (the `org` query survives).
4. Confirm cadence: SaaS schedule is `cron(0 * * * ? *)`; self-hosted logs `[fb-e cron] starting insights rollup (every 60 min)` (or the configured interval).

## Expected outcomes

- [ ] Analytics shows Activity + Impact; Accuracy shows only false-positive sections.
- [ ] `/dashboard/insights` (+ `?org=`) 308-redirects to `/dashboard/accuracy` with the query preserved.
- [ ] No user-facing "FP" jargon remains (nav "Accuracy"; "False-positive funnel"; "Top recurring false-positive themes").
- [ ] Rollup fires hourly on both backends; `INSIGHTS_ROLLUP_INTERVAL_MINUTES` overrides the self-hosted interval; invalid / unset → 60.
- [ ] Both pages render identically under `DEPLOYMENT_MODE=saas` (DynamoDB) and self-hosted (Postgres).

## Failure modes

- ❌ Cost / cycle / engagement still appear on `/dashboard/accuracy` (should be Analytics-only).
- ❌ `/dashboard/insights` 404s instead of redirecting, or drops the `org` query.
- ❌ The rollup still runs only once a day.
