# E2E-22: Claim-aware critical verification (W2)

A CRITICAL derived from a truncated diff — where the cited identifier *is* present near the anchor (so structural grounding passes it) but the claim is false against the full file — must be dropped by the LLM verification pass (`verifyCriticalFindings`, `CRITICAL_VERIFICATION_PROMPT`) using the complete file fetched via the always-on `groundingFetch` context. Fail-safe: missing file / LLM error / unparseable output keeps the finding.

This is the gap E2E-17 cannot close (identifier presence ≠ claim truth) and the systemic false positive in voice-bot #31 *and* #39 ("missing await on async X" with line numbers that pointed at the call site while the `await` was just outside the hunk).

## Apply

```bash
./scripts/apply-fixture.sh 22-claim-aware-verify
```

## Expected outcomes

- [ ] No surviving CRITICAL claiming `searchCandidates` is unawaited / a missing-await race
- [ ] If an agent produced one, logs show `[critical-verify] dropped false-positive critical …` with a reason citing the `await` on the assignment line
- [ ] LLM/infra failure path keeps the finding (do not regress the fail-safe — exercise by pointing at an unreachable model in a self-hosted run)

## Failure modes

- ❌ "Missing await" critical rendered despite `const rows = await kbStore.searchCandidates(...)` in the file (#31/#39 regression)
- ❌ Verification drops a *real* missing-await when the `await` is genuinely absent (over-suppression)

## Limitation

The runner overlays in a single commit, so on first push the entire file (including `const rows = await …`) lands inside the diff hunk. The ideal regression repro — the `await` line as **unchanged context** while only `.map(...)` and `return` are inside the hunk — needs the file to exist on the branch already, then a follow-up commit that touches only those two lines.

## Optional two-commit variant (for the truncated-hunk shape)

```bash
./scripts/apply-fixture.sh 22-claim-aware-verify
# After the first review lands, edit src/kb.ts: rename `names` → `ids` and
# return `ids.length` (touching only the .map/return lines), then:
git add src/kb.ts && git commit -m 'tweak: rename names → ids' && git push
```

The second commit's hunk no longer contains the `await` line, which is exactly the truncated-hunk shape the W2 verifier must guard against.

## Genuinely-broken variant

To confirm verification doesn't blanket-suppress, edit `src/kb.ts` to drop the `await` (`const rows = kbStore.searchCandidates(...)`) and push. The next review should retain the missing-await critical.
