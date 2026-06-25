# E2E-65: Analytics tabbed view — Accuracy folded in (#227)

`/dashboard/analytics` is a **tabbed view** instead of one long scroll. Tabs, left to right: **Overview** (the four stat cards + Merge-score / Findings-per-review trends), **Cost & Impact** (the Impact panel — LLM spend, cycle time, engagement), **Findings** (severity, category, score distribution), **Activity** (reviews per repo, duration, status), and **Accuracy** (the former `/dashboard/accuracy` surface, rendered via `InsightsClient`). The active tab is reflected in `?tab=` (e.g. `?tab=cost`) via `history.replaceState` — shareable and refresh-safe, with no server round-trip, and any `?org=` is preserved. The default tab (`overview`) renders with **no** `?tab=` param. The global **date-range + repo filter bar shows only on the data tabs** (Overview / Findings / Activity); Cost & Impact and Accuracy own their 7d/30d/90d window selector. The tab bar always renders, so Cost & Accuracy stay reachable even while the analytics dataset is loading/empty/errored. The standalone **Accuracy nav item is removed** (it's a tab now); **`/dashboard/accuracy` redirects** to `/dashboard/analytics?tab=accuracy` (org preserved), so old links — including the `/dashboard/insights` → `/dashboard/accuracy` hop — still resolve. On narrow screens the tab bar scrolls horizontally.

Dashboard-inspection fixture; reuses any installation with review + rollup data (**E2E-56 / 59 / 63** seeds). No fixture PR.

## Procedure

1. Open `/dashboard/analytics?org=<id>` — lands on **Overview** (stat cards + 2 trends); URL has no `?tab=`. Sidebar has no "Accuracy" item.
2. Click **Cost & Impact** — URL becomes `?tab=cost`; the Impact panel (spend / cycle / engagement) renders immediately with its own window selector; the date-range/repo filter bar is hidden.
3. Click **Findings** then **Activity** — URL flips to `?tab=findings` / `?tab=activity`; the filter bar reappears and applies to the charts.
4. Click **Accuracy** — URL `?tab=accuracy`; the false-positive funnel / dispute-rate / themes render (same content as the old page).
5. Reload on `?tab=cost` — the Cost tab is still active (refresh-safe). Copy the URL to another tab — same view (shareable).
6. Visit `/dashboard/accuracy?org=<id>` — redirects to `/dashboard/analytics?tab=accuracy&org=<id>`. Visit `/dashboard/insights?org=<id>` — still resolves through to the Accuracy tab.
7. Narrow the viewport (mobile) — the tab bar scrolls horizontally; the filter controls wrap.

## Expected outcomes

- [ ] Analytics renders as tabs; cost/impact is reachable in one click with no scrolling.
- [ ] Active tab is in `?tab=` (default `overview` has none); refresh and link-share preserve it; `?org=` survives tab switches.
- [ ] Filter bar appears only on Overview / Findings / Activity; Cost & Accuracy use their own window selector.
- [ ] `/dashboard/accuracy` (+ `?org=`) redirects to `?tab=accuracy`; `/dashboard/insights` still resolves; no standalone Accuracy nav item.
- [ ] Cost & Accuracy tabs work even when the analytics dataset is empty/loading/errored.

## Failure modes

- ❌ Page is still one long scroll, or cost is below the charts.
- ❌ Switching tabs reloads the server page / loses `?org=` / doesn't update the URL.
- ❌ `/dashboard/accuracy` 404s or the Accuracy tab is blank.
- ❌ The date filter bar shows on the Cost or Accuracy tab (double window selectors).
