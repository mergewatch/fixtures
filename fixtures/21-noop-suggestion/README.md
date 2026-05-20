# E2E-21: No-op-suggestion guard (W1)

A finding whose suggested fix is *already what the code does* must be dropped outright (any severity). `groundFinding` runs `suggestionAlreadyApplied()`: splits the suggestion into code-shaped segments and drops the finding when every segment already appears (whitespace-normalized) in the file.

Distinct from E2E-17 (anchor on a comment line / identifier absence). Here the identifier **is** present and on the right line — the tell is that the suggested replacement equals the existing code. Canonical case: voice-bot #31 (suggestion `const run = await migrationRunner({` on a line that already reads exactly that).

## Apply

```bash
./scripts/apply-fixture.sh 21-noop-suggestion
```

## Expected outcomes

- [ ] No finding titled/described as "missing await on `migrationRunner`" (or similar) survives to the rendered comment
- [ ] If an agent emitted one, logs show it dropped by the no-op guard (suggestion already present), not merely line-snapped
- [ ] `Suppressed N` count reflects the drop

## Failure modes

- ❌ A critical/warning "missing await" rendered with a suggestion that is byte-identical to the cited line (the #31 regression)

## Note

Stochastic on a real LLM. To force the case in a self-hosted run, inject into the orchestrator response:

```json
{
  "file": "src/already-awaited.ts",
  "line": 2,
  "severity": "critical",
  "title": "Missing await on async migrationRunner call",
  "description": "migrationRunner result is not awaited.",
  "suggestion": "Add await before migrationRunner: const run = await migrationRunner({"
}
```

The guard must drop it.
