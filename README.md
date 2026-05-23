# mergewatch-fixtures

Scratch repo for [MergeWatch](https://github.com/apps/mergewatch) end-to-end tests.

The authoritative test procedure lives upstream: [`mergewatch.ai/e2e/RUNBOOK.md`](https://github.com/santthosh/mergewatch.ai/blob/main/e2e/RUNBOOK.md). This repo holds the fixture overlays and the runner that materializes each fixture as a real GitHub PR.

## Layout

```
src/                          # baseline source tree fixtures mutate
fixtures/<NN-name>/           # one directory per E2E-NN card from the runbook
  overlay/                    # files copied on top of the baseline working tree
  meta.env                    # BRANCH / TITLE / DRAFT / etc. for the runner
  README.md                   # fixture summary + expected-outcomes checklist
scripts/
  bootstrap.sh                # seed + tag e2e-baseline (one-time); also resets between runs
  apply-fixture.sh            # reset → branch → overlay → push → open PR
```

## Workflow

```bash
# one-time (fresh clone only)
./scripts/bootstrap.sh

# run a fixture
./scripts/apply-fixture.sh 01-clean-pr

# verify against fixtures/01-clean-pr/README.md, then tear down
gh pr close <N> --delete-branch
```

`apply-fixture.sh` always resets to `e2e-baseline` before applying an overlay, so fixtures stay reproducible regardless of prior runs.

## Fixture index

| ID | Name | Behavior | Manual? |
|---|---|---|---|
| E2E-01 | `01-clean-pr` | Clean PR → 5/5 + APPROVE + empty review body | |
| E2E-02 | `02-info-only` | Info-only findings → 5/5, "All clear" + Info collapsible | |
| E2E-03 | `03-critical-finding` | Critical finding → inline comment + REQUEST_CHANGES | |
| E2E-04 | `04-auto-review-off` | `autoReview: false` → zero PR trace | |
| E2E-05 | `05-mention-override` | `autoReview: false` + `@mergewatch review` → review runs | reuses 04 |
| E2E-06 | `06-docs-only` | Docs-only → visible "Review skipped" | |
| E2E-07 | `07-include-patterns` | Docs-only + `includePatterns` → review runs | |
| E2E-08 | `08-mention-overrides-skip` | Docs-only + `@mergewatch review` → review runs | reuses 06 |
| E2E-09 | `09-draft-pr` | Draft PR → "Review skipped — Draft PR" | |
| E2E-10 | `10-skip-review-label` | `skip-review` label → "Review skipped — label" | post-open label |
| E2E-11 | `11-resynchronize` | Push new commit → old review dismissed + comment edited in place | reuses 01 |
| E2E-12 | `12-rerun-check` | Click "Re-run" on the check → new review fires | UI only |
| E2E-13 | `13-inline-reply-engages` | Human replies in MergeWatch inline thread → MergeWatch responds | reuses 03 |
| E2E-14 | `14-third-party-thread` | Human replies in non-MergeWatch thread → no engagement | post-open UI |
| E2E-15 | `15-mermaid-stress` | Complex diff → renderable Mermaid diagram | |
| E2E-16 | `16-agent-authored` | PR from `claude/*` branch → flagged as agent-authored | |
| E2E-17 | `17-grounding-hallucinated-anchor` | Comment-line anchor → grounding snaps or drops the finding | stochastic |
| E2E-18 | `18a-introduce-criticals` → `18b-fix-criticals` | Two-step: criticals introduced → fix pushed → delta-aware green verdict | sequenced |
| E2E-19 | `19-confidence-default-off` | No `XX%` confidence badges on a default install | |
| E2E-20 | `20-description-drift` | PR description claims `localStorage` but diff uses memCache → reviewer flags drift | spot-check |
| E2E-21 | `21-noop-suggestion` | Finding whose suggested fix already matches the code → dropped by W1 no-op guard | stochastic |
| E2E-22 | `22-claim-aware-verify` | Truncated-diff "missing await" critical → dropped by W2 claim verification | stochastic |
| E2E-23 | `23-convergence` | Re-review never lists same concern as ✅ Resolved + 🆕 new (W9); author triage suppresses (W3) | two-commit + triage |
| E2E-24 | `24-triage-author-filter` | Non-author `## mergewatch triage` does NOT suppress (security boundary) | two-account |
| E2E-25 | `25-w7-guardrail` | Unverified-only Critical → score clamps to 3/5 + COMMENT (not REQUEST_CHANGES) | stochastic |
| E2E-26 | `26-call-site-snap` | Finding about a function snaps to call site, not definition (W8) | |
| E2E-27 | `27-no-harness` | `AGENTS.md` declares no test suite → N "lacks coverage" findings collapse into one info note | |
| E2E-28 | `28a-single-comment-approve` + `28b-single-comment-critical` | One issue comment + one formal Review per run; Review body empty/stub (W6) | two fixtures |
| E2E-29 | `29-cluster` | Fragmented findings on the same code region merge into one with the strongest severity (W10) | stochastic |
| E2E-30 | `30-confidence-floor` | Findings with `confidence < 75` deterministically dropped (FP-A) | stochastic |
| E2E-31 | `31-prev-disputed-prefilter` | Rebutted prior findings excluded from orchestrator's `previousFindings` (FP-B) | manual triage + sync |
| E2E-32 | `32-cross-agent-dedup` | Same-file-same-line cross-agent doubles merge before orchestrator (FP-C) | |
| E2E-33 | `33-diagram-hallucinated-path` | Diagram citing a file NOT in the PR's changed-files set is dropped entirely (FP-D) | stochastic |
| E2E-34 | `34-warning-verification` | Warning-severity findings flow through W2 verification + gain `verification` tag (FP-E) | |
| E2E-35 | `35-inline-resolve` | Inline `/resolve` reply persists the finding's key — next review doesn't re-emit (FP-F) | manual resolve + sync |
| E2E-36 | `36a-linter-present-eslint` + `36b-no-linter` | Linter-aware style agent defers lint-equivalent findings when eslint is present (FP-G) | two fixtures |
| E2E-37 | `37-fp-record-storage` | FindingDispositionRecord rows written on every surfacing, dispute, resolve (FB-A) | DB inspection |
| E2E-38 | `38-quiet-drop` | Finding gone without code change → `silentDropCount` increments (FB-B) | manual unrelated-file push |
| E2E-39 | `39-inline-reactions` | 👎/🤔 increments `disputeCount`; 👍/❤️/🚀 increments `agreementCount` on inline (FB-C) | manual reactions |
| E2E-40 | `40-mergewatch-reject` | `/mergewatch reject <category> [reason]` persists a categorised rejection (FB-D) | manual slash command |
| E2E-41 | `41-nightly-rollup` | Nightly scheduled job produces InstallationFPInsight rollups (FB-E) | Lambda / admin endpoint |
| E2E-42 | `42-funnel-chart` | Dashboard FP funnel chart: unsignaled / agreed / silentDropped / disputed (FB-F) | dashboard inspection |
| E2E-43 | `43-dispute-by-agent` | Dashboard dispute-rate by agent category bar chart (FB-G) | dashboard inspection |
| E2E-44 | `44-themes-table` | Dashboard sortable table of top-10 disputed clusters (FB-H) | dashboard inspection |
| E2E-45 | `45-severity-shopping` | Severity-shopping detector chart: warnings vs criticals dispute rate (FB-I) | dashboard inspection |
| E2E-46 | `46-repo-heatmap` | Per-repo FP heatmap on the org dashboard (FB-J) | dashboard inspection |
| E2E-47 | `47-suggest-rule` | High-dispute cluster gets a copy-able `.mergewatch.yml` snippet suggestion (FB-K) | dashboard CTA |
| E2E-48 | `48-known-fp-injection` | Opt-in `feedback.learnFromDisputes` injects top-K disputed clusters as soft prompt guidance (FB-L) — **TARGET** | config + pre-seed |
| E2E-49 | `49-re-review-no-anchoring` | Re-review on a fix commit does NOT pattern-match round-1's framing onto unrelated code (FP-H) | manual fix + push |
| E2E-50 | `50-suggestion-redundant` | Finding whose `suggestion` is byte-equivalent to existing code is dropped by the verifier (FP-I) | |
| E2E-51 | `51-no-self-contradiction` | Re-review does NOT critique the application of a prior recommendation (FP-J L2) | manual fix + push |
| E2E-52 | `52-unverified-critical-render` | Unverified critical drops off inline / action-table; lands in dedicated "Unverified concerns" sub-section (FP-L) | stochastic |
| E2E-53 | `53-dispute-aware-reconcile` | Red verdict softened to advisory when majority of action findings are from chronically-disputed categories (FP-J L1/L3) | pre-seed FB-A data |
| E2E-54 | `54a-abstraction-drizzle` + `54b-abstraction-encodeuri` + `54c-abstraction-jsx-text` + `54d-abstraction-raw-sql-keep` | Abstraction-aware verifier drops Drizzle eq() / encodeURIComponent / JSX text findings; keeps raw SQL (FP-K) | four fixtures |

Each `fixtures/<NN-name>/README.md` has the verification checklist for that card.

## Two-step fixtures

E2E-18 ships as two fixture directories sharing one branch (`fixture/18-delta-aware-verdict`):

```bash
./scripts/apply-fixture.sh 18a-introduce-criticals   # opens the PR with security holes
# wait for first review (orange/red verdict)
./scripts/apply-fixture.sh 18b-fix-criticals         # pushes fix to same branch, no new PR
# wait for second review (should be green per delta-aware reconciliation)
```

`18b` uses the runner's `PUSH_TO_EXISTING_BRANCH` mode — it checks out the existing branch from origin, overlays the fix, and pushes a synchronize commit without opening a new PR.

## Smoke test (~5 min)

```bash
./scripts/apply-fixture.sh 01-clean-pr
./scripts/apply-fixture.sh 04-auto-review-off
./scripts/apply-fixture.sh 06-docs-only
```

If all three behave per their fixture READMEs, the deploy is at least minimally healthy.
