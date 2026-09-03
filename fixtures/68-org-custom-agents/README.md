# E2E-68: Org Custom Agents (#235)

Org admins define custom review agents in the dashboard (**Settings → Custom Agents**) that are enforced across the org's repos — promoting the per-repo `.mergewatch.yml` `customAgents` concept to the installation level. Each agent carries a prompt + default severity, a **repo scope** (all repos or a selected allowlist), optional **path-glob / language targeting**, and an **enforcement** mode (advisory or blocking). Agents are stored per installation (DynamoDB `#AGENTS` sentinel row / Postgres `installation_settings.custom_agents` jsonb).

At review time the runtime selects enabled agents that are in scope and match targeting, runs them in **union** with the repo's `.mergewatch.yml` `customAgents` (**org wins on a name collision**), and — for a **blocking** agent — a **critical** finding forces `REQUEST_CHANGES` plus a failing check run regardless of the merge score (`Blocked by org agent: <name>`). Only org admins can edit; members are read-only. Each agent records its last editor and timestamp, and a soft cap warns past ~10 active agents. Authors can still triage a blocking finding, but the triage is recorded (disposition store + a `[org-agents]` log).

## Why this fixture is manual (mergewatch.ai#510)

`PREREQ_CHECK` reads the `#AGENTS` row from DynamoDB, and **the E2E gate job has
no AWS credentials** — its whole environment is `GH_TOKEN` and `MW_STAGE`. The
prerequisite is therefore unsatisfiable in CI by construction, and no amount of
seeding changes that.

Until fixtures#1550 the failure printed *"Could not auto-discover the
installation id"*, which reads as a missing row, so this looked like a seeding
problem for weeks. It was an access problem.

The fixture was selected on every gate run and skipped on every gate run, which
made the graded total read **49 when 48 was the number that could ever pass**. A
count nobody can reach is worse than a smaller honest one — it is the same
coverage illusion as an ungraded fixture (fixtures#1076).

So it is `NEEDS_HUMAN_STEP`, not `MANUAL_ONLY`: the PR is still opened and
reviewed normally when a person runs it with credentials. Only the automated
selection changes.

**Making it automated again** needs the gate job to hold AWS credentials, or the
prerequisite moved to an interface that needs none (the dashboard API and MCP
both expose org-agent state). Both are open questions on mergewatch.ai#510 —
this is the honest interim, not the end state.

## Apply

**Configure the org agent first** — this fixture is inert without it
(fixtures#469: the 2026-08-19 run degraded silently when the row was absent).
Seed it from the CLI (writes the `#AGENTS` sentinel row exactly as the
dashboard would):

```bash
scripts/seed-org-agent.sh            # no-todo, critical, advisory, all repos
```

or via the dashboard: Settings → Custom Agents → Add agent, name `no-todo`,
prompt *"Flag any new TODO comment"*, severity `critical`, enforcement
**advisory**, scope **All repositories**.

The fixture's `PREREQ_CHECK` runs `scripts/seed-org-agent.sh --verify` before
applying; when the row is missing, `run-suite.sh` records the fixture as
`skipped-missing-prereq` instead of opening an inert PR.

2. Then:

```bash
./scripts/apply-fixture.sh 68-org-custom-agents
```

The overlay adds `src/todo-work.ts` (two fresh `// TODO` comments under `src/**`, no genuine defect — so any finding must come from the org agent) and a `.mergewatch.yml` declaring a **repo-level** `customAgents` entry with the **same name** `no-todo` but a weaker `info` severity. If precedence holds, the org definition runs and the repo one is shadowed.

Then walk the enforcement and scoping steps:

3. **Blocking run** — flip the agent to **blocking** and re-review (`@mergewatch review`). The summary review must be **REQUEST_CHANGES** and the MergeWatch check run **failure**, titled `Blocked by org agent: no-todo`.
4. **Scope** — switch the agent to **Selected repositories** and pick a *different* repo. Re-review this PR → the agent does **not** run. Switch back → it does.
5. **Targeting** — add path glob `docs/**`. Re-review → the agent does **not** fire on this `src/**`-only PR. Change it back to `src/**` → it fires again.
6. **Permissions** — reload Settings → Custom Agents as a non-admin member: fields are read-only, and a direct API write returns **403**.
7. **Both backends** — repeat on a self-hosted (Postgres) instance; behavior must be identical.

## Expected outcomes

- [ ] Admins can CRUD org agents; members are read-only; the API rejects non-admin writes (**403**).
- [ ] In-scope, targeting-matching agents run, in **union** with repo `customAgents` — and the **org** definition wins the `no-todo` name clash (finding is `critical`, not the repo's `info`).
- [ ] Advisory agent only surfaces findings; the check still passes and the score is normal.
- [ ] Blocking agent's critical → **REQUEST_CHANGES** + failing check titled `Blocked by org agent: no-todo`, regardless of the merge score.
- [ ] Repo scope (all / selected) and path-glob targeting gate execution correctly.
- [ ] Last-edited-by/when is recorded; the soft-cap warning appears past the limit.
- [ ] Identical behavior on DynamoDB (SaaS) and Postgres (self-hosted).

## Failure modes

- ❌ A non-admin can edit org agents (the write succeeds).
- ❌ A blocking critical finding still APPROVES or passes the check.
- ❌ An out-of-scope or non-matching-targeting agent runs anyway.
- ❌ The repo `.mergewatch.yml` agent shadows or disables the org agent of the same name (precedence inverted — the tell is an `info` TODO finding instead of a `critical` one).
