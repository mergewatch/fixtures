# E2E-79: UX block — comment presentation

The `ux` block controls how the review comment is *presented*, and nothing about what the review *finds*. Knobs: `tone` (`collaborative` | `direct` | `advisory`), `showWorkDone`, `showSuppressedCount`, `reviewerChecklist`, `allClearMessage`, and `commentHeader` (replaces the default logo header).

The whole `ux` block was previously untested. Two properties matter most: **tone must not change the finding set**, and **`commentHeader` must be escaped** — it is attacker-adjacent text that renders into every review comment the installation posts.

## Apply

```bash
./scripts/apply-fixture.sh 79-ux-block
```

The overlay sets **every** knob away from its default at once, so one review exercises the whole block, and adds `src/ux-bait.ts`. That file carries three unambiguous, textbook defects (SQL injection; hardcoded signing key compared non-constant-time; unhandled rejection) — chosen because the central assertion is a *comparison across runs*, which only works if the finding set is stable. Vague code would drift between reviews and make the comparison meaningless. Two of the defects sit in the same region so dedup/clustering has something to suppress, giving `showSuppressedCount` a real non-zero number.

`commentHeader` is seeded with markdown, raw HTML, and a link: `# Acme Review Bot <img src=x onerror=alert(1)> [click](…) **bold**`.

Then walk the knobs back one at a time, pushing between each step:

1. `tone: collaborative` → `direct` → `advisory`. Diff the **finding set** across the three runs — the phrasing must shift, the set must not.
2. `showWorkDone: true` → the "work done" section reappears.
3. `showSuppressedCount: false` → the suppressed count disappears. With it `true`, cross-check the number against what dedup and the quality filters actually dropped (**E2E-29** / **E2E-30** / **E2E-32**).
4. `reviewerChecklist: false` → the checklist disappears.
5. `allClearMessage` — needs a clean PR to observe; reuse **E2E-01**'s diff on this branch, or read it alongside **78b**.

## Expected outcomes

- [ ] Each toggle changes **only** its own section; no cross-talk.
- [ ] `tone` changes phrasing without changing which findings are reported — the three tone runs report the same set.
- [ ] `showWorkDone: false` removes the work-done section; `true` restores it.
- [ ] `showSuppressedCount: true` reports a number **consistent with what the filters actually dropped**, not a placeholder.
- [ ] `reviewerChecklist: true` renders a checklist derived from the top findings.
- [ ] `allClearMessage: false` on a clean PR suppresses the all-clear block.
- [ ] `commentHeader` is **escaped** — the markdown heading, the `<img>` tag, the link, and the bold markers all render as literal text. No heading, no anchor, no image, no script.

## Failure modes

- ❌ `tone: direct` suppresses findings rather than rewording them.
- ❌ `commentHeader` allows raw HTML or markdown injection into every review comment — the highest-severity outcome on this card.
- ❌ `showSuppressedCount` reports 0 when the filters demonstrably dropped findings.
- ❌ A toggle bleeds into an unrelated section (e.g. `showWorkDone: false` also hiding the checklist).
