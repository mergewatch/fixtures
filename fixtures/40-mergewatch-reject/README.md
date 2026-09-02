# E2E-40: FB-D — `/mergewatch reject` slash command

New inline-thread intent parser alongside `detectResolveIntent`. Recognises `/mergewatch reject <category> [optional reason]` where `<category>` is one of:

- `already-handled`
- `out-of-scope`
- `wrong-target`
- `style-disagreement`
- `other`

Increments `disputeCount` AND appends `{ category, text?, at }` to `rejectReasons[]` on the `FindingDispositionRecord`. Bot confirms by appending a footer to the finding comment — *"✅ Marked **rejected** (`<category>`) — won't re-raise on this PR while the code is unchanged."* Not a thread reply: a reply is auto-wrapped into a standalone COMMENTED review (#190).

> **Corrected (mergewatch.ai#528).** This previously described a reply saying *"won't be re-raised on similar code unless conditions change"*, matching the footer the product shipped. Both overpromised. Suppression is scoped to **this PR** (`disputedKeys` come from the PR's own triage and inline replies) and the key embeds the cited code line as a fingerprint, so editing that line **ends** the suppression — the opposite of "similar code". Verify against the wording above, not the old sentence. Thread is NOT auto-resolved (different from `/resolve` — rejection is for *finding-level FP signal*, resolution is for *thread-level closure*).

## Apply

```bash
./scripts/apply-fixture.sh 40-mergewatch-reject
```

The overlay adds `src/admin-endpoint.ts` — same bait as E2E-35 (unauthenticated admin endpoint).

## Step 2 — slash command reply (manual)

After the first review renders the inline thread, reply on the thread:

```
/mergewatch reject style-disagreement we use snake_case for python here
```

## Expected outcomes

- [ ] The `FindingDispositionRecord` has `disputeCount = 1` and `rejectReasons[0] = { category: 'style-disagreement', text: 'we use snake_case for python here', at: <iso> }`
- [ ] The bot posts a structured confirmation reply
- [ ] The GitHub thread is **NOT** auto-resolved
- [ ] Recognised categories: `already-handled`, `out-of-scope`, `wrong-target`, `style-disagreement`, `other`
- [ ] Unrecognised category (`/mergewatch reject typo-here foo`) → silently coerced to `{ category: 'other', text: 'typo-here foo' }`; bot's confirming reply says "recording as `other`"
- [ ] Multiple `/mergewatch reject` replies on the same thread append to `rejectReasons[]` (don't overwrite)
- [ ] Top-level `## mergewatch triage` continues to function (FB-D is an inline-thread addition, not a replacement)
- [ ] `/resolve` and `/reject` are orthogonal — only `/resolve` auto-resolves the thread

## Failure modes

- ❌ `/mergewatch reject` is matched in prose ("here's how I'd reject this differently") — pattern must be standalone-line or slash-command form
- ❌ The thread is auto-resolved (signal collected; closure is human-driven)
- ❌ Unrecognised category writes nothing (must coerce to `other` and preserve the original token in `text`)
