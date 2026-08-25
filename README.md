# mergewatch-fixtures

Scratch repo for [MergeWatch](https://github.com/apps/mergewatch) end-to-end tests.

The authoritative test procedure lives upstream: [`mergewatch.ai/e2e/RUNBOOK.md`](https://github.com/santthosh/mergewatch.ai/blob/main/e2e/RUNBOOK.md). This repo holds the fixture overlays and the runner that materializes each fixture as a real GitHub PR.

## Layout

```
.mergewatch.yml               # baseline model pin: suite reviews run on Sonnet 4.5
                              # (fixtures#585 — keeps suite load off Opus 4.6's daily
                              # token quota; keep this file model:-only)
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

## Bait sterility (issue #349)

Everything the reviewer can see must read like a real engineer's PR. The
reviewer ingests the **diff, the PR title/body, and config comments** — if any
of it says "E2E", "fixture", "bait", or gives harness instructions, the model
rationally excuses the planted defect ("intentional test code") and the fixture
silently stops testing anything (see mergewatch.ai#368).

Rules for authoring or editing fixtures:

- Overlay files carry only comments a production author would write. The defect
  must stand on its own; never annotate it.
- `meta.env` `TITLE` / `BODY` are the PR title/body — write them as natural
  change descriptions. No `E2E-NN`, no README pointers.
- The grading contract (expected outcomes, failure modes, RUNBOOK card mapping)
  lives **only** in the fixture's `README.md`, which is never shipped in a PR.
- The fixture ↔ PR mapping is the **branch name** (`fixture/NN-…`), which the
  runner and `/verify-suite` key on.

## Selective runs (#416)

Every fixture's `meta.env` carries two selection fields:

- **`TAGS=`** — what the fixture covers (`agents`, `billing`, `oss`, `skip`,
  `output`, `dashboard`, `rollup`, `mcp`, …). Multiple, comma-separated.
- **`MODE=`** — *how* it is verified, which is what a grader has to dispatch on:

  | MODE | Count | Verified by |
  |---|---|---|
  | `pr` | 66 | Open a PR, read the review comment and check run |
  | `dynamo` | 14 | Assert table state directly |
  | `dashboard` | 13 | Browser, or the API feeding the chart |
  | `mcp` | 4 | MCP client calls |
  | `checks-api` | 1 | GitHub checks API (`check-runs/:id/rerequest`) |

`MODE` is the automation roadmap for the 36 fixtures still marked
`MANUAL_ONLY`: 14 are plain DynamoDB assertions, 13 need a dashboard check,
and **4 are already `MODE=pr` — automatable today, just never wired**
(`47-suggest-rule`, `48-known-fp-injection`, `58-engagement-resolve`,
`61-helpful-prompt`).

```bash
# See what a selection resolves to — costs nothing
scripts/select-fixtures.sh --tag agents
scripts/run-suite.sh --tag billing --dry-run

# Run a subset
scripts/run-suite.sh --tag agents --tag output
scripts/run-suite.sh --mode dynamo

# Run only what a product change could have affected
git -C ../mergewatch.ai diff --name-only main... \
  | scripts/run-suite.sh --changed-files -
```

`--changed-files` resolves paths to tags via `e2e/impact-map.yml`. Two
deliberate behaviors there:

- **A path matching no rule runs the whole suite**, and `--explain` prints
  which path forced it. Silent under-selection is the failure that matters —
  a missed regression costs far more than a slow run.
- **An empty selection means "nothing relevant changed"** and runs nothing,
  rather than falling back to everything. Otherwise a docs-only PR would
  quietly become a 98-fixture run.

Always `--dry-run` first. A full run opens ~98 real PRs and spends real money.

## Grading a run (#416)

Two layers, deliberately:

```bash
node scripts/grade-run.mjs              # deterministic — no model, exits 1 on regression
node scripts/grade-run.mjs --stage dev  # grade the dev review instead
node scripts/grade-run.mjs --compare    # grade both stages, report divergence
node scripts/grade-run.mjs --json       # machine-readable
```

`grade-run.mjs` reads `.e2e/last-run.json`, fetches each PR, and evaluates that
fixture's `expect.json`. It asserts the things that are actually assertable:

| Field | Checks |
|---|---|
| `check` | check-run conclusion, or `"none"` for the silent-skip path |
| `checkTitleMatches` | regex against the check title (e.g. `"skip"`) |
| `score` | merge score — exact, or `{min,max}` |
| `findings` | per-severity counts — exact, or `{min,max}` |
| `reviewState` | `APPROVED` / `CHANGES_REQUESTED` / `none` |
| `reviewBody` | `"empty"` — pins the #132 regression |
| `comment` | `"present"` / `"absent"` |
| `mustContain` / `mustNotContain` / `mustMatch` | comment body |
| `inlineComments` | count of this stage's inline findings |
| `reactions` | `present` / `absent` (e.g. 👀 removed after completion) |

**A fixture with no `expect.json` is reported `UNGRADED`, never `PASS`.**
Counting an unasserted fixture as passing would make this layer worthless.
`/verify-suite` still grades those against the prose README, and still covers
the qualitative outcomes assertions cannot express ("findings quality unchanged
or better"). The two layers are complements, not alternatives.

Exit codes: `0` clean, `1` a regression or a PR that could not be fetched
(unverified is not the same as fine), `2` no manifest.

### Identifying the App

The grader matches reviews by **App login**, not by a "is this a bot" heuristic:
`gh pr view --json reviews` returns `author.is_bot: null` and a bare login
(`mergewatch`, not `mergewatch[bot]`), so every bot-detection heuristic silently
matches nothing and reports a review that plainly exists as missing. Override
with `--app-login` / `--dev-app-login` if your deployment's App slugs differ.

## Fixture index

| ID | Name | Behavior | Manual? |
|---|---|---|---|
| E2E-01 | `01-clean-pr` | Clean PR → 5/5 + APPROVE + empty review body | |
| E2E-02 | `02-info-only` | Info-only findings → 5/5, "All clear" + Info collapsible | |
| E2E-03 | `03-critical-finding` | Critical finding → inline comment + REQUEST_CHANGES | |
| E2E-04 | `04-auto-review-off` | `autoReview: false` → zero PR trace | |
| E2E-05 | `05-mention-override` | `autoReview: false` + `@mergewatch review` → review runs | manual · reuses 04 |
| E2E-06 | `06-docs-only` | Docs-only → visible "Review skipped" | |
| E2E-07 | `07-include-patterns` | Docs-only + `includePatterns` → review runs | |
| E2E-08 | `08-mention-overrides-skip` | Docs-only + `@mergewatch review` → review runs | manual · reuses 06 |
| E2E-09 | `09-draft-pr` | Draft PR → "Review skipped — Draft PR" | |
| E2E-10 | `10-skip-review-label` | `skip-review` label → "Review skipped — label" | post-open label |
| E2E-11 | `11-resynchronize` | Push new commit → old review dismissed + comment edited in place | manual · reuses 01 |
| E2E-12 | `12-rerun-check` | Click "Re-run" on the check → new review fires | UI only |
| E2E-13 | `13-inline-reply-engages` | Human replies in MergeWatch inline thread → MergeWatch responds | manual · reuses 03 |
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
| E2E-36 | `36a-linter-present-eslint` + `36b-no-linter` | Lint-equivalent nits are NEVER findings — anti-noise hard list, linter or no linter (#376 Option 1); both arms identical, with an in-scope perf control proving the style agent is alive (FP-G) | two fixtures |
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
| E2E-55 | `55-ttm-capture` | Every PR writes one PRLifecycleRecord; open/push/merge/close transitions captured; `closed` doesn't trigger a review; set-once + terminal-state discipline (TTM) | manual open/push/merge/close |
| E2E-56 | `56-ttm-rollup` | Hourly rollup attaches a `cycleTime` block (merge counts + median/p75/p90 time-to-merge, segmented reviewed vs unreviewed); open/closed excluded from time stats (TTM) | seed + rollup |
| E2E-57 | `57-ttm-dashboard` | `/dashboard/analytics` Cycle time section: StatCards + reviewed-vs-unreviewed bar; relaxed zero-state gate; `null` → `—` (TTM) | dashboard inspection, reuses 56 |
| E2E-58 | `58-engagement-resolve` | `/resolve` on an inline thread increments `resolveCount` on the FindingDispositionRecord alongside `disputeCount`; defaults 0, no backfill; both backends (engagement) | manual resolve + DB inspection |
| E2E-59 | `59-engagement-rollup` | Hourly rollup attaches an `engagement` block (acceptance, command usage, approx action rate, re-review rate, reviewed-PR count); `null` for empty denominators (engagement) | seed + rollup |
| E2E-60 | `60-engagement-dashboard` | `/dashboard/analytics` Developer engagement section: StatCards + cross-window trend; relaxed gate; `null` → `—`; trend gaps on null windows (engagement) | dashboard inspection, reuses 59 |
| E2E-61 | `61-helpful-prompt` | Summary comment renders "Was this review helpful? 👍/👎"; reacting records a snapshot-delta (monotonic); rollup fills `helpful*`; dashboard Helpful rate (engagement) | manual reactions |
| E2E-62 | `62-nps-survey` | `/dashboard/analytics` NPS prompt (0–10), throttled once/90d per `githubUserId`; rollup computes NPS = %promoters − %detractors; NPS StatCard (engagement) | dashboard interaction |
| E2E-63 | `63-cost` | Each review writes a ReviewCostRecord; hourly rollup aggregates a `cost` block (total spend, avg/review, cost/finding, per-repo); unknown-model = "unpriced", excluded from money (cost) | seed + rollup + dashboard |
| E2E-64 | `64-dashboard-restructure` | Dashboard split by intent: Analytics = Activity + Impact; FP Insights renamed Accuracy; old `/dashboard/insights` 308-redirects; rollup hourly both runtimes (#218) | dashboard inspection |
| E2E-65 | `65-analytics-tabs` | `/dashboard/analytics` tabbed (Overview · Cost & Impact · Findings · Activity · Accuracy); active tab in `?tab=`; `/dashboard/accuracy` → `?tab=accuracy`; filter bar scoped to data tabs (#227) | dashboard inspection |
| E2E-66 | `66-selfhosted-cost-pricing` | Self-hosted cost populates whenever the model is priced; `.mergewatch.yml` `pricing:` override parsed; `0`/`0` = priced $0; unpriced → actionable hint + one-time warn (#231) | self-hosted + dashboard |
| E2E-67 | `67-env-model-pricing` | `LLM_MODEL_INPUT/OUTPUT_PRICE_PER_1M` price the global `LLM_MODEL` (incl. a Bedrock ARN); inline replies priced too; per-repo `pricing:` wins; partial/invalid → one-time warn (#233) | self-hosted env |
| E2E-68 | `68-org-custom-agents` | Org-level custom agents run in union with repo `customAgents` (org wins on name clash); blocking critical → REQUEST_CHANGES + `Blocked by org agent:` check; scope + path targeting gate execution (#235) | dashboard config first |
| E2E-69 | `69-mcp-review-diff` | MCP `review_diff` reviews a supplied diff with no PR; `repo` loads config + conventions; `agentAuthored: true`; grounding still applies; `-32602` on bad params | MCP curl / stdio |
| E2E-70 | `70-mcp-review-status` | MCP `get_review_status` returns the latest review row; `mergewatch://conventions/{owner}/{repo}` serves resolved conventions markdown | MCP, reuses 01 |
| E2E-71 | `71-mcp-api-key-scope` | API keys are admin-only, hashed, shown once; out-of-scope repo → `-32001`; revocation effective on the next request; `lastUsedAt` advances | dashboard + API |
| E2E-72 | `72-mcp-session-dedup` | Same `sessionId` within 30 min bills only the positive delta; new session bills in full; window expiry resets; omitting `sessionId` disables dedup | paid installation |
| E2E-73 | `73-billing-free-tier` | 5 lifetime free reviews per installation; the 6th blocks **before** the LLM call (no cost record); notification fires once; MCP returns `-32002` | fresh installation |
| E2E-74 | `74-billing-topup` | Manual top-up creates no subscription; auto-reload off by default; concurrent drops produce exactly one charge (`autoReloadInFlight`); declined card blocks | Stripe test card |
| E2E-75 | `75a-maxfiles-over` + `75b-maxfiles-boundary` | Over `rules.maxFiles` → **visible** "Review skipped" check naming the limit; mention overrides; boundary is inclusive | two fixtures |
| E2E-76 | `76a-review-on-mention-off` + `76b-both-triggers-off` | `reviewOnMention: false` suppresses mention-triggered reviews (reason `reviewOnMentionOff`, not `autoReviewOff`); both flags off → no trigger path | two fixtures |
| E2E-77 | `77a-exclude-generated` + `77b-exclude-all-changed` | `excludePatterns` filters the **agent diff** without changing the skip decision; excluding every changed file yields a clean review, not a crash | two fixtures |
| E2E-78 | `78a-output-shaping` + `78b-post-summary-on-clean` | `minSeverity` filters inclusively by tier; `maxFindings` truncates **by rank** and discloses it; `postSummaryOnClean: false` drops the comment but not the check run | two fixtures |
| E2E-79 | `79-ux-block` | `ux` toggles change only presentation — `tone` rewords without changing the finding set; `commentHeader` is escaped against markdown/HTML injection | config iterations |
| E2E-80 | `80a-conventions-order` + `80b-conventions-cap` | Discovery order `conventions:` → `AGENTS.md` → `CONVENTIONS.md` → `.mergewatch/conventions.md`, first hit wins, explicit path never falls back; >16 KB truncates with a visible marker | two fixtures |
| E2E-81 | `81-file-request-budget` | `codebaseAwareness` fetches out-of-diff files within `maxFileRequestRounds` / `maxContextKB`; awareness off → no fabricated contents; budget hit degrades, not fails | config iterations |
| E2E-82 | `82-oss-sponsored-review` | Active OSS grant sponsors reviews on the named public repo with no free-tier/balance consumption; unnamed repos gated; private flip stops sponsorship, rename doesn't; revoke degrades to free tier (#263, #265) | dedicated installation + grant |
| E2E-83 | `83-oss-grant-lifecycle` | `grant-oss.ts` grant/add/remove/revoke/inspect; refuses without `--stage`; private repo rejected; blast radius shown before writing (#266) | operator CLI |
| E2E-84 | `84-windowed-rollups` | `periodCounts` per-UTC-day buckets written atomically with lifetime counters; rollup windows sum only in-window activity (`7d ≤ 30d ≤ 90d`); legacy records ramp up instead of injecting lifetime history (#334) | seed + rollup trigger |
| E2E-85 | `85-time-ordered-reviews` | `listReviews` via `ByRepoCreatedAt` GSI: true `createdAt` order across PR numbers; date bounds in the key condition; loss-free v2 cursors; sticky legacy fallback without the GSI (#335) | seed + dashboard/API |
| E2E-86 | `86-p95-nearest-rank` | p95 duration uses nearest-rank (`⌈n × 0.95⌉`); < 20 completed reviews → "—" + tooltip, no P95 bar; 20 distinct durations → second-highest, not the max (#336) | dashboard inspection |
| E2E-87 | `87-date-only-bounds` | `/api/analytics` date-only bounds expand to UTC day edges (`end_date` includes its whole day); full timestamps honored verbatim; identical on both backends (#337) | seed + API inspection |

Each `fixtures/<NN-name>/README.md` has the verification checklist for that card.

## Two-step fixtures

E2E-18 ships as two fixture directories sharing one branch (`fixture/18-delta-aware-verdict`):

```bash
./scripts/apply-fixture.sh 18a-introduce-criticals   # opens the PR with security holes
./scripts/apply-fixture.sh 18b-fix-criticals         # waits for 18a's review, then pushes the fix
# wait for second review (should be green per delta-aware reconciliation)
```

`18b` uses the runner's `PUSH_TO_EXISTING_BRANCH` mode — it checks out the existing branch from origin, overlays the fix, and pushes a synchronize commit without opening a new PR. Before pushing, it **blocks until the step-1 review's check run completes** (10s polls, 600s timeout — tune with `WAIT_TIMEOUT`, skip with `WAIT_FOR_REVIEW=0`). Reviews grade the cumulative PR diff, so pushing the fix before the first review lands would collapse both phases into one already-fixed diff and the introduce-phase review would never happen (mergewatch.ai#375).

## Smoke test (~5 min)

```bash
./scripts/apply-fixture.sh 01-clean-pr
./scripts/apply-fixture.sh 04-auto-review-off
./scripts/apply-fixture.sh 06-docs-only
```

If all three behave per their fixture READMEs, the deploy is at least minimally healthy.
