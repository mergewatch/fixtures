# E2E-49: FP-H — anti-anchoring on prior findings

Two layers compose:
- **Layer 1** — `buildPreviousFindingsBlock` includes an explicit "CRITICAL (FP-H)" counter-instruction telling the orchestrator the previous-findings list is for stable-identity matching ONLY, not a stylistic template. Pattern-matching is named as a known failure mode and explicitly forbidden.
- **Layer 2** — `verifyFindings` accepts a `previousFindings` arg and renders a prior-context block listing prior titles + per-prior sigToken bags. The verifier prompt gains a new INVALID condition: *"the current finding overlaps heavily with a prior finding's tokens AND the cited line does not contain the construct"*.

## Apply

```bash
./scripts/apply-fixture.sh 49-re-review-no-anchoring
```

The overlay adds:
- `src/worker.ts` — async functions with NO error handling (bait for legitimate round-1 findings).
- `src/unrelated.ts` — a pure-sync helper with NO async / error-handling code (round-2 must not pattern-match a "missing error handling" finding here).

## Step 2 — fix all + tiny unrelated change (manual)

1. Edit `src/worker.ts` to address ALL the round-1 findings (wrap each `await` chain in `try/catch` with logging; surface a typed error).
2. Add a tiny change to `src/unrelated.ts` — e.g., change the format string `${name} (${count})` → `${name} [${count}]`.
3. Commit + push:
   ```bash
   git commit -am 'fix: handle errors in worker; tweak label format' && git push
   ```

## Expected outcomes (round-2 re-review)

- [ ] Round-2 re-review on the fix commit does NOT produce findings that critique `src/unrelated.ts` using the round-1 frame ("error handling", "silent failure", etc.)
- [ ] Agent log includes a `Prior review context` block in the verifier prompt when the fix-commit re-review fires
- [ ] Round-1 findings that are genuinely fixed are correctly marked as ✅ resolved
- [ ] **Regression check**: a fresh PR with NO prior reviews produces the same findings as before FP-H landed (no false suppression on first reviews)

## Failure modes

- ❌ Round-2 still produces "this LOOKS LIKE the kind of finding round-1 had" pattern-matches on `src/unrelated.ts`
- ❌ Counter-instruction matches too aggressively and suppresses genuinely-still-live carry-forward findings
