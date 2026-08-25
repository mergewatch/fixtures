# Verifying the MANUAL_ONLY fixtures

24 `correctness` fixtures cannot be graded by `grade-run.mjs`, because it reads
GitHub and their assertions live somewhere else — DynamoDB, an MCP endpoint, or
a rendered page.

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

| table | PK | SK |
|---|---|---|
| `mergewatch-installations-dev` | `installationId` | `repoFullName`, or a sentinel — `#SETTINGS`, `#AGENTS`, `#MARKETPLACE`, `#PENDING-OSS` |
| `mergewatch-reviews-dev` | `repoFullName` | `{pr}#{sha}` |
| `mergewatch-pr-lifecycle-dev` | `{installationId}#{owner}/{repo}` | PR number |
| `mergewatch-finding-dispositions-dev` | `{installationId}#{owner}/{repo}` | finding key |
| `mergewatch-installation-fp-insights-dev` | `installationId` | `window` (`7d` / `30d` / `90d`) |
| `mergewatch-review-costs-dev` | `installationId` | `{owner}/{repo}#{pr}#{sha}` |

Billing, OSS-grant and Marketplace attribution fields all live on the
**installations** table:

- billing / OSS → `installationId = <id>`, `repoFullName = '#SETTINGS'`
- Marketplace → `installationId = '#MARKETPLACE'`, `repoFullName = <lowercased account login>`

## The two shapes of command

Read one row:

```bash
aws dynamodb get-item --profile mergewatch --region us-west-2 \
  --table-name mergewatch-installations-dev \
  --key '{"installationId":{"N":"<id>"},"repoFullName":{"S":"#SETTINGS"}}'
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
  --query 'Items[0].installationId.N' --output text
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
