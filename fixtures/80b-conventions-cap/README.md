# E2E-80b: Conventions — the 16 KB truncation cap

Conventions content is capped at **16 KB** (`CONVENTIONS_MAX_BYTES`). Beyond that it is truncated with a visible `[truncated — showing first 16 KB]` marker, and the review still completes. The failure this guards against is subtle: an over-cap file truncated *silently* mid-sentence leaves the agents acting on half a rule while the author believes the whole file applied.

Split from **80a** because it needs an intentionally oversized conventions file rather than four small ones.

## Apply

```bash
./scripts/apply-fixture.sh 80b-conventions-cap
```

The overlay sets `conventions: docs/house-rules.md` explicitly — the cap is tested on a known path, with auto-discovery left to **80a** — and ships an oversized `docs/house-rules.md` (>16 KB) carrying **two** rules:

- an **EARLY-RULE** near the top, inside the cap: never use `var`
- a **LATE-RULE** near the bottom, past the cap: never call `console.log`

`src/cap-bait.ts` violates **both**. The pair is the readout: the `var` rule must be cited, the `console.log` rule must not. Citing both means the cap isn't applied; citing neither means the file didn't resolve at all — check **80a** before concluding anything.

## Expected outcomes

- [ ] The review **completes** — an over-cap conventions file must not fail or stall it.
- [ ] The injected conventions text is truncated at 16 KB and carries a visible `[truncated — showing first 16 KB]` marker.
- [ ] The **EARLY-RULE** (`var`) is cited — content inside the cap reaches the agents.
- [ ] The **LATE-RULE** (`console.log`) is **not** cited — content past the cap does not.
- [ ] The review names `docs/house-rules.md` as the `sourcePath`.
- [ ] Truncation is at a byte boundary with the marker attached, not a silent mid-sentence cut.

## Failure modes

- ❌ An over-cap file truncates mid-sentence with **no** marker, so the agents act on half a rule with nobody the wiser.
- ❌ The whole file is injected regardless of size, inflating every prompt on the installation.
- ❌ An over-cap conventions file fails the review instead of degrading to a truncated read.
- ❌ Both rules are cited (cap not enforced) or neither is (file never resolved).
