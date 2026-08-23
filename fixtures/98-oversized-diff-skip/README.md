# E2E-98 — #423: oversized diffs skip with a reason, never hard-fail

Reproduces the shape of `santthosh/orca#117`, where a 558KB `tsconfig.tsbuildinfo`
was 80% of a 711KB diff and every fallback layer collapsed into
`ValidationException: Input is too long for requested model` — no findings, no
partial result, no guidance.

## What this PR contains

| file | size | which layer catches it |
|---|---|---|
| `tsconfig.tsbuildinfo` | ~328 KB | **default `excludePatterns`** — `**/*.tsbuildinfo` |
| `src/geo-regions.json` | ~599 KB | **`maxFileDiffKB`** (128) — matches no pattern, so only the size cap catches it |
| `src/rate-limiter.ts` | <1 KB | nothing — this is the file under review |

The two artifacts are deliberately different: one is the class we already knew
about, the other is the *next* artifact, which a pattern list can never
anticipate. That distinction is the whole reason `maxFileDiffKB` exists.

`src/rate-limiter.ts` carries a real off-by-one — `recent.length <= limit + 1`
admits 11 requests for a limit of 10 — so the run also proves the review still
does its job on what remains.

## Expected outcomes

- [ ] The review **completes** — a summary comment with a parsed verdict, not an error
- [ ] `tsconfig.tsbuildinfo` is excluded and named in the logs: `Excluded N file(s) from diff: …`
- [ ] `src/geo-regions.json` is dropped by size and logged **separately**: `[input-budget] dropped N oversized file(s) over 128KB: …` — a pattern match is the operator's intent, a size drop is ours
- [ ] Neither artifact appears anywhere in the output — not in findings, inline comments, the file list, or the diagram
- [ ] No `ValidationException` and no "MergeWatch encountered an error" on any path

## What `expect.json` asserts, and what it does not

Asserted, because mechanical: the review completed and rendered a verdict, and
neither artifact's name appears in the comment.

**Not** asserted: whether the off-by-one surfaces, or at what severity. That is
model judgement, and the `correctness` tag means a deterministic contract — the
same reason E2E-02's info-count assertion was removed after two identical runs
disagreed. If the reviewer misses the bug the suite stays green here; that is a
different fixture's job.

The log assertions above are also not machine-checkable — `grade-run.mjs` reads
GitHub, not CloudWatch — so they remain a manual read.
