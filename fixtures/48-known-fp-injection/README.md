# E2E-48: FB-L — `{{KNOWN_FP_PATTERNS}}` prompt injection — **TARGET**

**Status: not yet implemented.** This is the target fixture for the FB-L feature; create the procedure now, exercise it once FB-L ships.

When the org has `feedback: { learnFromDisputes: true }` in `.mergewatch.yml`, the handler will fetch the latest `InstallationFPInsight`, pick top-K clusters with `surfaceCount ≥ 5` AND `disputeRate ≥ 75%`, and render them into a directive injected at `{{KNOWN_FP_PATTERNS}}` on every finding-producing agent prompt:

> *"In this organization the following finding patterns have been explicitly disputed by reviewers multiple times: [list with representative titles + sigTokens]. Report findings matching these patterns only if you have **strong** evidence — describe the evidence explicitly in the description."*

Soft guidance, not suppression. Log: `[fb-l] injected N known-FP patterns`.

No fixture-runner branch (procedure is hand-crafted).

## Procedure

1. Pre-seed one cluster meeting the threshold (surfaceCount ≥ 5, disputeRate ≥ 75%). E.g., a cluster of "missing await on async X" findings that were disputed via triage.
2. Create a config-only PR adding `.mergewatch.yml`:
   ```yaml
   feedback:
     learnFromDisputes: true
   ```
   Merge it (or scope to a fixture branch where you also include the next step).
3. Open a PR that has a finding matching that cluster's sigTokens (e.g. add `src/uses-async.ts` that draws an "await missing on async X" warning).
4. Wait for review.

## Expected outcomes

- [ ] Agent log shows `[fb-l] injected 1 known-FP pattern`
- [ ] The matching finding either (a) is omitted, or (b) appears with an *explicit evidence sentence* in its description (model honoured the "strong evidence" instruction)
- [ ] With `learnFromDisputes: false` (default), no log line, no directive, prompt is byte-identical to the FP-G shape
- [ ] Sub-threshold clusters (`surfaceCount = 3` or `disputeRate = 50%`) DO NOT leak into the prompt
- [ ] **Regression check**: an entirely new defect that happens to match a known-FP cluster but has a clear, explicit failure case still surfaces

## Failure modes

- ❌ Hard suppression: the model omits the finding without the evidence-sentence escape hatch
- ❌ Sub-threshold cluster leaks (threshold check must happen at directive-build time, not at write-time)
- ❌ Directive injection happens on the orchestrator's prompt rather than the per-agent prompts (loses the layered defense — orchestrator already has its own filters)
- ❌ With `learnFromDisputes` unset, the prompt diverges from the FP-G baseline byte-for-byte (must be exact back-compat)
