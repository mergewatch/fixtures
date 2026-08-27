# Verifying the MANUAL_ONLY fixtures

28 `correctness` fixtures cannot be graded by `grade-run.mjs`, because it reads
GitHub and their assertions live somewhere else — DynamoDB, an MCP endpoint, or
a rendered page.

That number is derived, not maintained — regenerate it rather than trusting it:

```bash
grep -l '^MANUAL_ONLY=true' fixtures/*/meta.env | sed 's|fixtures/||;s|/meta.env||' \
  | sort > /tmp/manual-only.txt
comm -12 /tmp/manual-only.txt <(scripts/select-fixtures.sh --tag correctness) | wc -l
```

`scripts/select-fixtures.sh --tag correctness --manual` returns **31**, not 28.
It is a superset: `--manual` also keeps the three `NEEDS_HUMAN_STEP` fixtures
(`35`, `39`, `40`), which *are* graded by `grade-run.mjs` — they just need a
person to act inside the run. This page covers the 28 that grading cannot
reach at all.

They are verified **locally**, against the **dev** stage. That was a deliberate
choice (mergewatch.ai#443): automating them in CI would need a standing OIDC
role with DynamoDB access for the suite job, to automate scenarios that mostly
need *seeded state* anyway. The read is the easy half; arranging the world
first is the hard half, and that is easy locally and awkward in CI.

## Before you start

```bash
aws sts get-caller-identity --profile mergewatch   # confirm the session is live
```

SSO sessions are short. If a command returns "session has expired", re-login
and re-run — a half-finished verification is worse than none, because the
fixture looks checked.

> **Always the `-dev` tables.** Every command below ends in `-dev`. The prod
> tables hold real installations and real balances. Several of these fixtures
> exist to prove a *counter* moved, and reading is one typo away from writing
> in a shell you are iterating in.

## Where things live

Schema is public and documented in `docs/architecture.md`; this is the working
subset.

Two columns, because conflating them is the most common way these commands
fail: the **attribute** is what a `--key` or `--key-condition-expression` names,
the **value** is what you put in it. Half these tables use generic `pk`/`sk`
attributes whose values happen to be composites.

| table | PK attribute | SK attribute | PK value · SK value |
|---|---|---|---|
| `mergewatch-installations-dev` | `installationId` (S) | `repoFullName` (S) | the id · the repo, or a sentinel — `#SETTINGS`, `#AGENTS`, `#MARKETPLACE`, `#PENDING-OSS` |
| `mergewatch-reviews-dev` | `repoFullName` (S) | `prNumberCommitSha` (S) | the repo · `{pr}#{sha}` |
| `mergewatch-pr-lifecycle-dev` | `pk` (S) | `sk` (S) | `{installationId}#{owner}/{repo}` · PR number |
| `mergewatch-finding-dispositions-dev` | `pk` (S) | `sk` (S) | `{installationId}#{owner}/{repo}` · finding key |
| `mergewatch-installation-fp-insights-dev` | `installationId` (S) | `window` (S) | the id · `7d` / `30d` / `90d` |
| `mergewatch-review-costs-dev` | `pk` (S) | `sk` (S) | the id · `{owner}/{repo}#{pr}#{sha}` |
| `mergewatch-satisfaction-dev` | `pk` (S) | `sk` (S) | `{installationId}#{owner}/{repo}` · the review key |

`mergewatch-reviews-dev` also carries the **`ByRepoCreatedAt`** GSI —
`repoFullName` (HASH) / `createdAt` (RANGE). That index, not the base table, is
what gives true reverse-chronological order; the base SK sorts PR numbers as
strings (`"9#…" > "42#…" > "100#…"`). Fixture `85` asserts on it.

> **Every key attribute is a string (`S`) — `installationId` included.** It is
> numeric-looking and it is not a number. `{"N":"..."}` fails a `get-item` with
> a validation error, which is survivable; in a `scan` filter it just matches
> nothing, and an empty result reads as "this repo has no installation" rather
> than "you asked for the wrong type".

> **On a `pk`/`sk` table, do not filter on `installationId` or `repoFullName`.**
> `review-costs` carries both as ordinary non-key attributes, but
> `finding-dispositions` and `pr-lifecycle` carry neither — a scan filtering on
> `repoFullName` there returns `[]` no matter how much data is in the table.
> Query `pk` instead.

Billing, OSS-grant and Marketplace attribution fields all live on the
**installations** table:

- billing / OSS → `installationId = <id>`, `repoFullName = '#SETTINGS'`
- Marketplace → `installationId = '#MARKETPLACE'`, `repoFullName = <lowercased account login>`

## The two shapes of command

Read one row:

```bash
aws dynamodb get-item --profile mergewatch --region us-west-2 \
  --table-name mergewatch-installations-dev \
  --key '{"installationId":{"S":"<id>"},"repoFullName":{"S":"#SETTINGS"}}'
```

List rows under one partition:

```bash
aws dynamodb query --profile mergewatch --region us-west-2 \
  --table-name mergewatch-reviews-dev \
  --key-condition-expression 'repoFullName = :r' \
  --expression-attribute-values '{":r":{"S":"mergewatch/fixtures"}}'
```

Find the installation id for the fixtures repo:

```bash
aws dynamodb scan --profile mergewatch --region us-west-2 \
  --table-name mergewatch-installations-dev \
  --filter-expression 'repoFullName = :r' \
  --expression-attribute-values '{":r":{"S":"mergewatch/fixtures"}}' \
  --query 'Items[0].installationId.S' --output text
```

The repo is `mergewatch/fixtures`. If this prints `None`, the session or the
type is wrong before the installation is — `.N` on a string attribute prints
exactly that.

Query one partition on a `pk`/`sk` table — the id above, composed:

```bash
aws dynamodb query --profile mergewatch --region us-west-2 \
  --table-name mergewatch-finding-dispositions-dev \
  --key-condition-expression 'pk = :p' \
  --expression-attribute-values '{":p":{"S":"<id>#mergewatch/fixtures"}}'
```

## Not DynamoDB

- **MCP** (`69`–`72`) — call the Function URL with an API key and assert the JSON-RPC response.
- **Dashboard** (`66`, `67`) — read the rendered page. Where a number is the real assertion, prefer the API beneath it.
- **`12-rerun-check`** — the trigger is a "Re-run" click; `POST /repos/{owner}/{repo}/check-runs/{id}/rerequest` does the same thing.

## Recording the result

There is nowhere for this to land automatically — that is the point of the
`NOT VERIFIED` line in a graded run. Note what you checked in the fixture's PR
or the run's issue. An unrecorded manual pass is indistinguishable from one
that never happened.

---

## Adding a fixture: advance `e2e-baseline`

Fixture branches are cut from the **`e2e-baseline` tag**, not from `main`. A fixture whose directory was added to `main` after the tag last moved **cannot be applied** — `apply-fixture` resets to the tag, the directory is not there, and the failure reads like a typo.

That is not hypothetical: `97` and `98` were merged, absent from the tag, and the deploy gate's first full-coverage run failed on `98` and blocked production.

After merging a new fixture:

```bash
git diff --stat e2e-baseline main -- src/     # MUST be empty
git tag -f e2e-baseline main && git push -f origin e2e-baseline
```

The `src/` check is the important half. `src/` is the app under review — if the tag moves it, every fixture's baseline shifts and past runs stop being comparable. Harness-only changes (`fixtures/`, `scripts/`, `e2e/`) are always safe to pull in.

`run-suite.sh` now refuses to start when a selected fixture is missing from the tag, and prints this command.
