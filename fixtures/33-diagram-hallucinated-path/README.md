# E2E-33: FP-D — diagram path validation

`parseDiagramResponse` (`packages/core/src/agents/reviewer.ts`) post-processes every Mermaid diagram against the PR's changed-file set (derived once up-front from `extractChangedLines(diff)` in `runReviewPipeline`). The validator extracts every path-shaped token (`*/*.ext`, 1–8-char extension, URLs stripped) and accepts each one if it exactly matches a changed file, is a trailing-segment suffix of one (`db.ts` → `packages/server/src/db.ts`), or has a changed file as its own trailing suffix. Any cited path that matches none of those → the **entire** diagram is dropped (`{ diagram: '', caption: '' }`) and the comment-formatter renders no Mermaid block. Fail-open: when `changedFiles` is undefined/empty, validator returns `ok: true`.

## Apply

```bash
./scripts/apply-fixture.sh 33-diagram-hallucinated-path
```

The overlay adds `src/a.ts` only — a single-file `UserRepo` refactor that implies a larger module structure (`db.ts`, `types/user.ts`, etc.). The diagram agent often invents related file nodes; FP-D should drop the whole diagram if it does.

## Expected outcomes

- [ ] If a diagram is emitted, every path it cites is in the PR's changed-files set (only `src/a.ts`)
- [ ] If the diagram cites a hallucinated path, the rendered comment has **no Mermaid block** (silent drop, no parse error)
- [ ] Agent log includes `[fp-d] dropping diagram — cites N file(s) not in the PR diff: …`
- [ ] **Regression check**: a diagram referencing only real changed files renders normally
- [ ] **Regression check**: a diagram with no path-shaped tokens at all (sequence/state diagrams) renders normally
- [ ] **Regression check**: a diagram containing a `https://example.com/page.html` URL inside a label does NOT trigger a drop

## Failure modes

- ❌ The rendered comment shows a Mermaid node whose label is a path not in the PR
- ❌ A legitimate diagram gets dropped because the path-extraction regex over-matches (e.g. picks up part of a function name and treats it as a file)
- ❌ A URL inside a diagram label triggers a false-positive drop

## Note

Stochastic — the diagram agent may not hallucinate this time. To force the failure path in a self-hosted run, inject a Mermaid diagram referencing `src/db.ts` (not in the diff) into the diagram-agent response and confirm the rendered comment has **no Mermaid block**.
