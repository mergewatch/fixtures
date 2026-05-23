# E2E-47: FB-K — Suggest `.mergewatch.yml` rule CTA

On any row in the FB-H themes table with `disputeRate > 80%` AND `surfaceCount ≥ 5`, a "Suggest ignore rule" CTA appears. Clicking expands an inline pane showing a pre-generated `.mergewatch.yml` snippet built from the cluster's sigTokens + categories. One-click copy. **No auto-write** to the repo — user pastes manually.

Note: the auto-generated snippet uses `customStyleRules` as a **soft guard** rather than a hard ignore. The style agent gets a "be cautious" instruction; the cluster pattern still gets evaluated, just with higher evidence bar. Hard suppression (a future `ignoreFindings` config field) would be a separate workstream.

No new branch or PR.

## Procedure

1. Pre-seed a high-dispute-rate cluster (90% disputeRate, 10 surfacings).
2. Navigate to `/dashboard/<installation>/insights` and locate the cluster row in the themes table (FB-H).
3. Click the "Suggest ignore rule" CTA.

## Expected outcomes

- [ ] CTA appears only when both thresholds are met (disputeRate > 80% AND surfaceCount ≥ 5)
- [ ] Snippet uses the cluster's sigTokens as title-pattern keywords
- [ ] Snippet is valid `.mergewatch.yml` (parses; doesn't break loading)
- [ ] One-click copy to clipboard
- [ ] No request to write to the repo is initiated

## Failure modes

- ❌ Snippet escapes special characters incorrectly and the YAML doesn't parse
- ❌ Threshold check uses surfaceCount alone (single highly-disputed finding gets a suggestion — too aggressive)
- ❌ CTA auto-writes to the repo without user confirmation
