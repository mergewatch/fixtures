# E2E-69: MCP — `review_diff` runs the pipeline on a supplied diff

An external coding agent calls the `review_diff` tool over MCP and gets a full review of a diff that is **not** attached to any pull request. Required param `diff` (unified diff); optional `repo` (`owner/repo` — loads that repo's `.mergewatch.yml` plus resolved conventions), `description` (freeform intent, surfaced to the agent prompts), and `sessionId` (billing dedup — see **E2E-72**). Reviews arriving this way are marked **`agentAuthored: true`**, which flips them into the stricter `agentReview` path (the same path **E2E-16** exercises from a `claude/*` branch). Two transports: HTTP/JSON-RPC 2.0 over a Lambda Function URL (SaaS) and stdio (self-hosted).

MCP-surface fixture, no fixture PR. Requires a valid API key from **E2E-71** and the MCP Function URL from the `McpFunctionUrl` stack output.

## Procedure

```bash
curl -s "$MCP_URL" \
  -H "Authorization: Bearer $MW_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{
        "name":"review_diff",
        "arguments":{
          "repo":"<owner>/mergewatch-fixtures",
          "description":"Add an unvalidated query param to the handler",
          "diff":"--- a/src/utils.ts\n+++ b/src/utils.ts\n@@\n+export function q(req){ return db.raw(`SELECT * FROM t WHERE id=${req.query.id}`) }\n"
        }}}'
```

1. **Baseline** — `tools/list` returns exactly `review_diff` and `get_review_status` with the schemas in `http-dispatcher.ts`; `resources/list` advertises the conventions resource.
2. **Review** — the call above returns findings for the injected SQL concern.
3. **Repo config honoured** — set `minSeverity: critical` in this fixture repo's `.mergewatch.yml`, re-run with the same `repo` → warnings disappear. Re-run **without** `repo` → the config is not applied.
4. **Conventions honoured** — add a convention forbidding the pattern under test (see **E2E-80** for the resolution order); confirm the finding's framing reflects it when `repo` is passed.
5. **Agent-authored** — confirm the stored review row has `agentAuthored: true`.
6. **Grounding** — submit a diff citing code the repo does **not** contain; confirm grounding drops the hallucinated anchor exactly as on a PR (**E2E-17**).
7. **stdio transport** — run the same tool call against the self-hosted stdio server; identical findings.

## Expected outcomes

- [ ] `tools/list` advertises both tools; `resources/list` advertises the conventions resource.
- [ ] `review_diff` with only `diff` returns findings (no `repo` required).
- [ ] Passing `repo` loads that repo's `.mergewatch.yml` **and** conventions; omitting it does neither.
- [ ] `description` reaches the agent prompts (visible in the finding's reasoning).
- [ ] The review is recorded with `agentAuthored: true`.
- [ ] Malformed params → JSON-RPC `-32602`; internal failure → `-32603`.
- [ ] Same result over stdio and HTTP.

## Failure modes

- ❌ A diff citing code the repo doesn't contain still produces "grounded" criticals — grounding must apply here exactly as on a PR.
- ❌ `repo` is accepted but the config/conventions are silently ignored.
- ❌ The review is stored without `agentAuthored`, so `agentReview` strict mode never engages.
- ❌ A tool error is returned as HTTP 500 instead of a JSON-RPC error object.
