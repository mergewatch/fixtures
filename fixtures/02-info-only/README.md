# E2E-02: Info-only findings

A PR that produces ONLY info-severity findings should reconcile to 5/5 (not the orchestrator's lower score). Fix from #134.

## Apply

```bash
./scripts/apply-fixture.sh 02-info-only
```

## Expected outcomes

- [ ] Summary comment with `🟢 5/5 — No action items in the diff` (NOT 3/5 or 4/5).
      This fixture has info findings, so it gets the **info-only** 5/5 label — "No issues
      found in the diff" would contradict the notes rendered below it (mergewatch.ai#516).
- [ ] Verdict reason line: "No action items — only informational notes" (NOT "Multiple warnings")
- [ ] Action-items section: `🎉 All clear! No issues found`
- [ ] An "Info (N)" collapsible section IS present with ≥1 finding
- [ ] Formal PR review state = **Approved**

## Failure modes

- ❌ 3/5 or 4/5 with "All clear!" — bug #134 reappearing
- ❌ "Requires your attention" table appears — only action items (critical/warning) should populate it
