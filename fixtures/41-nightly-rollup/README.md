# E2E-41: FB-E — Nightly InstallationFPInsight rollup

Scheduled task (EventBridge → Lambda for SaaS; node-cron for self-hosted) runs nightly per installation. For each window (7d / 30d / 90d), aggregates `FindingDispositionRecord` rows into a single `InstallationFPInsight` row carrying `totalFindingsSurfaced`, `disputeRate`, `perCategory`, `topClusters[]` (via W10 token clustering), `perRepo`. Stored in `mergewatch-installation-fp-insights`. All dashboard charts read exclusively from these rollups.

No new branch or PR — this is a scheduled-task / API invocation fixture.

## Procedure

### Pre-seed

Pre-seed an installation with ~20 `FindingDispositionRecord` rows spanning 3 repos, 2 categories, ~30% dispute rate. The easiest way to seed naturally is to apply several existing fixtures (e.g. `21`, `22`, `23`, `26`, `29`, `35`) and post a couple of `## mergewatch triage` rebuttals.

### Trigger the rollup

**SaaS (Lambda)**:
```bash
aws lambda invoke \
  --function-name mergewatch-insights-rollup-prod \
  --payload '{"installationId": "<your-installation-id>"}' \
  /tmp/rollup-output.json && cat /tmp/rollup-output.json
```

**Self-hosted (admin endpoint)**:
```bash
curl -X POST \
  -H "Authorization: Bearer $MERGEWATCH_ADMIN_TOKEN" \
  http://localhost:3000/api/insights/rollup
```

### Inspect the rollup rows

**SaaS (DynamoDB)**:
```bash
aws dynamodb scan --table-name mergewatch-installation-fp-insights-prod
```

**Self-hosted (Postgres)**:
```sql
SELECT window, total_findings_surfaced, dispute_rate, per_category, top_clusters, per_repo
FROM installation_fp_insights
WHERE installation_id = '<id>';
```

## Expected outcomes

- [ ] Three rollup rows per installation per night (`7d`, `30d`, `90d` windows)
- [ ] `topClusters[]` is populated via `extractSignificantTokens` + union-find on shared tokens, sorted by `surfaceCount × disputeRate`
- [ ] `perRepo[repoFullName]` populated for every repo with ≥ 1 surfacing in the window
- [ ] Job is idempotent — re-running the same night doesn't double-count
- [ ] Job completes within 60s for the largest expected installation

## Failure modes

- ❌ Rollup reads or writes the wrong installation's records (cross-install contamination)
- ❌ A repo deleted mid-window crashes the rollup
- ❌ Cluster sigToken extraction differs from W10's — analytics should reuse the same helper, not a parallel one
