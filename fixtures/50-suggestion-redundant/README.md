# E2E-50: FP-I — verify suggestion-already-implemented

Two layers compose:
- **Layer 1** — `FINDING_VERIFICATION_PROMPT` carries a new INVALID condition asking the model to check whether the suggestion's code-shaped content (backticks / fences) is already at the cited line. Zero added LLM cost — same call, longer prompt.
- **Layer 2** — new `suggestionMatchesExistingCode(suggestion, fileContent, line)` helper. Extracts code chunks (fenced blocks → inline backticks), normalises whitespace, requires ≥10 chars (avoids generic-punctuation false positives), checks substring overlap in the cited ±5-line window. `verifyFindings` consults this BEFORE the LLM call; on match, drops the finding with `[finding-verify] dropped … — FP-I L2: suggestion already implemented at cited location` and no model invocation.

## Apply

```bash
./scripts/apply-fixture.sh 50-suggestion-redundant
```

The overlay adds `src/log-already.ts` — code that already calls `console.warn('failed', err)` on the catch path. The model often emits a "log the error" finding whose suggestion byte-matches the existing line; FP-I L2 must short-circuit-drop it.

## Expected outcomes

- [ ] Agent log: `[finding-verify] dropped … — FP-I L2: suggestion already implemented at cited location`
- [ ] The finding does NOT appear in the rendered review
- [ ] Zero LLM calls for that finding (deterministic short-circuit)
- [ ] **Regression check**: a finding whose suggestion contains genuinely new code goes through verification normally
- [ ] **Regression check**: prose-only suggestions ("Consider refactoring") fall through to the LLM verifier path

## Failure modes

- ❌ Generic-punctuation suggestions (`;`, `}`) trigger false-positive drops (the 10-char floor must be enforced)
- ❌ Suggestion text that mentions OTHER code in the file but proposes a different fix gets dropped (the cited ±5-line window must be respected — far-away matches don't count)
