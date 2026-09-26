# E2E-102: `skipPatterns` — user-added trivial paths

The inverse of **E2E-07**. `includePatterns` forces a PR that *would* skip into
review; `skipPatterns` adds paths to the built-in trivial list so a PR that
*would* be reviewed is skipped instead.

`skipPatterns` was the only one of the three pattern keys with no end-to-end
fixture (mergewatch.ai#653): `excludePatterns` has 77a/77b, `includePatterns`
has 07, and this one had unit tests only.

## Apply

```bash
./scripts/apply-fixture.sh 102-skip-patterns
```

## Why the changed paths matter

The overlay touches exactly two files:

| file | matches a built-in `SKIP_PATTERNS` entry? |
|---|---|
| `src/legacy/csv-import.ts` | **no** — an ordinary TypeScript source file |
| `.mergewatch.yml` | **no** — the built-in list names `.editorconfig`, `.prettierrc*`, `.eslintrc*`, `.gitignore`, but no project config |

That is the whole design. Had the changed file been a `*.md`, anything under
`docs/`, a lock file, or a `dist/` artifact, the PR would skip **whether or not
`skipPatterns` was honoured** — the fixture would pass for a reason unrelated to
the key it claims to test (mergewatch.ai#543). Verified against the shipped list
rather than assumed:

```
shouldSkipPR(['.mergewatch.yml', 'src/legacy/csv-import.ts'], [], [])
  -> null                      # no skipPatterns: reviewed normally
shouldSkipPR(['.mergewatch.yml', 'src/legacy/csv-import.ts'], [],
             ['src/legacy/**', '.mergewatch.yml'])
  -> 'Only config changed'     # with skipPatterns: skipped
```

`.mergewatch.yml` has to be in the list too. The overlay commits it, so it is a
changed file in the PR, and one non-trivial file is enough to make the whole PR
reviewable — the same reason **77b** excludes the config alongside the generated
client. It is still read from the branch head, so listing it does not disable it.

## Expected outcomes

- [ ] The PR is **skipped**: a visible neutral check run titled "Review skipped"
- [ ] The check summary names the trivial category (`Only … changed`)
- [ ] **No** summary comment
- [ ] **No** formal PR review, and no inline comments
- [ ] Nothing in the importer is reviewed — no findings about `parseLegacyCsv`

The category word inside the reason is not asserted. It comes from a heuristic
over the file names and reads `config` here because `.mergewatch.yml` is
dot-prefixed; the mechanism under test is the skip, not the wording.

## Failure modes

- ❌ The PR gets a normal review — `skipPatterns` was parsed but never read
  (mergewatch.ai#611 was exactly this class of bug).
- ❌ Skipped, but with a rules-based reason ("Draft PR", "PR has label …",
  "PR has N changed files"). That is a skip from the wrong cause, and
  `checkSummaryMatches` fails it rather than letting it read as a pass.
- ❌ Skipped silently: no check run at all, so the author cannot tell the review
  was suppressed deliberately (the `autoReview: false` path, not this one).
- ❌ `src/legacy/**` matches the directory but not the file inside it — a
  `minimatch` semantics regression.

## Control run

Removing the `skipPatterns` block from `overlay/.mergewatch.yml` and re-applying
must produce a **normal review** — 👀 → in-progress check → summary comment →
success check. If it still skips, the skip is coming from somewhere else and this
fixture is not observing `skipPatterns`.
