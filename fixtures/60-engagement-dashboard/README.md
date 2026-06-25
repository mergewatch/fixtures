# E2E-60: Engagement — dashboard section (engagement metrics, stage 3)

`/dashboard/analytics` renders a **Developer engagement** section (below Cycle time, above the FP funnel): four StatCards — Acceptance rate, Action rate (approx), Command usage (`N resolve · N reject`), Re-review rate (`N PRs reviewed`) — plus a cross-window acceptance/action trend line (7d / 30d / 90d). A `null` rate renders `—`, never `0%`. The action-rate card is labeled "approx". The zero-state gate is relaxed so the page shows when **any** of FP-feedback, cycle-time, or engagement has data, each section gated independently. No new API route — `/api/insights` already returns the `engagement` block.

Dashboard-inspection fixture; reuses the **E2E-59** installation. No fixture PR. Shipped in #209.

## Procedure

Branch: `fixture/60-engagement-dashboard`. Use the E2E-59 installation (an `engagement` block on its rollup rows). Open `/dashboard/analytics?org=<installationId>` and switch the 7d / 30d / 90d window selector.

## Expected outcomes

- [ ] The Developer engagement section renders below Cycle time with correct StatCard values for the active window.
- [ ] `null` rates render `—` (e.g. acceptance with nothing acted on), never `0%`.
- [ ] The Action rate card reads "approx" in its label/subtext.
- [ ] Command usage shows `N resolve · N reject` matching the rollup counts.
- [ ] The trend line plots acceptance + action across the windows; a window with no signal shows a gap (no connected line through null).
- [ ] Switching the window selector updates the StatCard numbers.
- [ ] An installation with engagement signal but **zero findings surfaced** still shows this section (relaxed gate); a fresh install with none of FP/cycle/engagement shows "No insights yet".
- [ ] An older rollup row without an `engagement` block renders the page unchanged (no engagement section).

## Failure modes

- ❌ A `null` rate renders as `0%` (an empty install looks like a 0%-acceptance install).
- ❌ The trend line connects across a null window (`connectNulls` regression), implying data that isn't there.
- ❌ The section throws on a pre-#195 rollup with no `engagement` (must be optional).
- ❌ The action-rate card drops the "approx" label (misrepresents the proxy as exact).
