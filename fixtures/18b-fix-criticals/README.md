# E2E-18b: Fix criticals (step 2 of 2)

Pushes the security fix on top of E2E-18a's branch (`fixture/18-delta-aware-verdict`). MergeWatch should re-review and produce a **green or yellow net-improvement verdict** reflecting that the criticals were resolved.

> Prerequisite: E2E-18a's PR is open and has completed its first review (verdict orange/red with criticals).

## Apply

```bash
./scripts/apply-fixture.sh 18b-fix-criticals
```

This fixture uses `PUSH_TO_EXISTING_BRANCH` semantics:
- No new branch, no new PR
- Checks out `fixture/18-delta-aware-verdict` from origin
- Applies the fixed `src/admin-api.ts` overlay
- Commits + pushes (synchronize triggers the re-review)

## Why the fix code is so verbose

Each handler wraps `await requireAdmin(req)` in `try` / `catch` with explicit 403 / 500 responses and an `AdminAuthError` class. That ceremony defuses specific LLM pattern-matches the reviewer fires on:
- "no error handling around the auth check"
- "auth failures propagate as 500s"

Both would count as **new** criticals on the fix commit, breaking the delta-aware verdict. On a real PR the ceremony would live in middleware; for this regression fixture we want to leave nothing for the reviewer to legitimately pick at, so the verdict reflects only the criticals-resolved delta.

## Expected outcomes (second review)

- [ ] "📎 Previously reported findings" section shows ≥1 criticals from step 1 marked as **✅ Resolved**
- [ ] Verdict line shows `🟢 4/5 — Generally safe`, or a green 5/5 — NOT red/orange.
      The 5/5 label depends on whether anything is still reported: `No issues found in the
      diff` when nothing is, `No action items in the diff` when only info notes remain
      (mergewatch.ai#516).
- [ ] If the LLM still flags 1-2 minor concerns on the fix, the verdict should land at **🟡 3/5** at worst (net-improvement tier — `resolvedCriticals > newCriticals` keeps it yellow, not red)
- [ ] Verdict reason mentions resolved criticals — either pure (*"Resolved N critical issues from prior review, no new criticals introduced."*) or net (*"Resolved N critical issues from prior review; introduced M new — net improvement, but review the new findings."*)
- [ ] Formal PR review state = **Approved** (empty body) on green, **Comment** on yellow
- [ ] Delta caption summarises the resolution (e.g. *"Replaced unauthenticated admin endpoints with `requireAdmin` guards and parameterized the SQL query"*)

## Failure modes

- ❌ Score red (1-2/5) despite `resolvedCriticals > newCriticals` (net-improvement tier regressed — this is what we saw before the defensive fix code landed)
- ❌ Resolved criticals counted as still-open in the verdict reason
- ❌ LLM flags >3 new criticals on the fix code — likely false positives. The fix is now defensive enough that this would indicate a quality regression in the agent prompts; report it
