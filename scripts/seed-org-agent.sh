#!/usr/bin/env bash
# Seed (or verify) the E2E-68 prerequisite: the org custom agent `no-todo`
# stored on the installation's `#AGENTS` sentinel row in DynamoDB.
#
# The fixture is inert without this row — generic agents flag the planted
# TODOs and the anti-pedantry pass correctly drops them, which grades as a
# suspicious "Suppressed: N" pass (see fixtures#469 / mergewatch.ai#382).
#
# Usage:
#   scripts/seed-org-agent.sh                     # seed (advisory, scope: all)
#   scripts/seed-org-agent.sh --enforcement blocking   # for the manual step-3 walk
#   scripts/seed-org-agent.sh --verify            # exit 0 if row+agent present, 3 if not
#
# Seeds the **dev** stage. This script writes — the `#AGENTS` sentinel is a
# put-item on the installations table — and the fixtures repo is installed in
# both stages, so a prod default put a write one env-var away from the real
# installations table (fixtures#1142). Point it at prod deliberately or not at
# all: `TABLE=mergewatch-installations-prod scripts/seed-org-agent.sh`.
#
# Env overrides:
#   TABLE            (default mergewatch-installations-dev)
#   AWS_PROFILE      (default mergewatch)
#   AWS_REGION       (default us-west-2)
#   INSTALLATION_ID  (default: auto-discovered by scanning TABLE for this repo)
set -euo pipefail

TABLE="${TABLE:-mergewatch-installations-dev}"
export AWS_PROFILE="${AWS_PROFILE:-mergewatch}"
export AWS_REGION="${AWS_REGION:-us-west-2}"

MODE="seed"
ENFORCEMENT="advisory"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --verify) MODE="verify" ;;
    --enforcement) shift; ENFORCEMENT="${1:?--enforcement needs advisory|blocking}" ;;
    --installation-id) shift; INSTALLATION_ID="${1:?--installation-id needs a value}" ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
  shift
done
case "$ENFORCEMENT" in advisory|blocking) ;; *) echo "enforcement must be advisory|blocking" >&2; exit 1 ;; esac

# --- resolve the installation id --------------------------------------------
if [ -z "${INSTALLATION_ID:-}" ]; then
  NWO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
  INSTALLATION_ID="$(aws dynamodb scan --table-name "$TABLE" \
    --filter-expression 'repoFullName = :r' \
    --expression-attribute-values "{\":r\":{\"S\":\"$NWO\"}}" \
    --projection-expression installationId \
    --query 'Items[0].installationId.S' --output text 2>/dev/null || true)"
  if [ -z "$INSTALLATION_ID" ] || [ "$INSTALLATION_ID" = "None" ]; then
    echo "Could not auto-discover the installation id for $NWO in $TABLE." >&2
    echo "Pass --installation-id <id> (or set INSTALLATION_ID)." >&2
    exit 1
  fi
fi

# --- verify mode ------------------------------------------------------------
if [ "$MODE" = "verify" ]; then
  # Distinguish "row absent" (exit 3 → skipped-missing-prereq) from an AWS
  # failure like expired credentials (exit 1 → real error), so an auth problem
  # is never silently recorded as a missing prerequisite.
  if ! AGENTS="$(aws dynamodb get-item --table-name "$TABLE" \
    --key "{\"installationId\":{\"S\":\"$INSTALLATION_ID\"},\"repoFullName\":{\"S\":\"#AGENTS\"}}" \
    --output json)"; then
    echo "✗ DynamoDB get-item failed (credentials/permissions?) — cannot verify prerequisite." >&2
    exit 1
  fi
  if echo "$AGENTS" | jq -e '
      .Item.agents.L // [] | map(.M) |
      any(.name.S == "no-todo" and .enabled.BOOL == true)' >/dev/null; then
    echo "✓ #AGENTS row present with an enabled no-todo agent (installation $INSTALLATION_ID)."
    exit 0
  fi
  echo "✗ No enabled no-todo org agent on installation $INSTALLATION_ID ($TABLE)." >&2
  echo "  Seed it with: scripts/seed-org-agent.sh" >&2
  exit 3
fi

# --- seed mode ----------------------------------------------------------------
# Item shape mirrors updateCustomAgents in packages/storage-dynamo/src/
# dashboard-store.ts; agent fields must satisfy sanitizeOrgCustomAgents
# (non-empty id/name/prompt, valid severityDefault/enforcement, scope).
NOW="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
aws dynamodb put-item --table-name "$TABLE" --item "{
  \"installationId\": {\"S\": \"$INSTALLATION_ID\"},
  \"repoFullName\":   {\"S\": \"#AGENTS\"},
  \"updatedAt\":      {\"S\": \"$NOW\"},
  \"agents\": {\"L\": [{\"M\": {
    \"id\":              {\"S\": \"no-todo\"},
    \"name\":            {\"S\": \"no-todo\"},
    \"prompt\":          {\"S\": \"Flag any new TODO comment\"},
    \"severityDefault\": {\"S\": \"critical\"},
    \"enforcement\":     {\"S\": \"$ENFORCEMENT\"},
    \"enabled\":         {\"BOOL\": true},
    \"scope\":           {\"M\": {\"mode\": {\"S\": \"all\"}}},
    \"updatedAt\":       {\"S\": \"$NOW\"},
    \"updatedBy\":       {\"S\": \"e2e-seeder\"}
  }}]}
}"
echo "✓ Seeded no-todo org agent (enforcement: $ENFORCEMENT) on installation $INSTALLATION_ID."
echo "  Verify: aws dynamodb get-item --table-name $TABLE --key '{\"installationId\":{\"S\":\"$INSTALLATION_ID\"},\"repoFullName\":{\"S\":\"#AGENTS\"}}'"
