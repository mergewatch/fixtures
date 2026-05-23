# E2E-39: FB-C — inline-comment 👎 reactions → disputes

Reactions on the bot's inline finding comments are collected and mapped:

| Reaction | Counter |
|---|---|
| 👎 (`-1`) | `disputeCount` |
| 🤔 (`confused`) | `disputeCount` |
| 👍 (`+1`) | `agreementCount` |
| ❤️ (`heart`) | `agreementCount` |
| 🚀 (`rocket`) | `agreementCount` |

Reaction *removal* is a no-op (signal stays monotonic). Anonymous: we count, we don't store reactor identity.

## Apply

```bash
./scripts/apply-fixture.sh 39-inline-reactions
```

The overlay adds `src/admin-endpoint.ts` — same bait as E2E-35 (unauthenticated admin endpoint), reliably draws an inline-comment-eligible Critical.

## Step 2 — reactions (manual)

After the first review renders the inline thread:

1. Confirm `FindingDispositionRecord` row exists post-review with `disputeCount = 0`, `agreementCount = 0`.
2. Add 👎 to the inline bot comment via the GitHub UI → confirm `disputeCount = 1`.
3. Add 🚀 → confirm `agreementCount = 1`.
4. Remove the 👎 → confirm `disputeCount` **stays at 1** (monotonic).

## Expected outcomes

- [ ] 👎 / 🤔 ↔ `disputeCount` mapping fires per-reaction
- [ ] 👍 / ❤️ / 🚀 ↔ `agreementCount` mapping fires per-reaction
- [ ] Reactions on the TOP-level bot comment continue to populate `ReviewItem.reactions` separately (back-compat)
- [ ] Reactions added by `mergewatch[bot]` itself are ignored (no self-counting)

## Failure modes

- ❌ Reaction removal decrements the counter (must be monotonic)
- ❌ Reactions on a CopilotAI / dependabot inline comment get attributed to a MergeWatch finding (must filter by `INLINE_BOT_COMMENT_MARKER`)
- ❌ Bot's own reactions count (loop)
