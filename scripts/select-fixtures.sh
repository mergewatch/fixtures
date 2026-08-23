#!/usr/bin/env bash
# Resolve a fixture selection from tags, modes, or a set of changed paths (#416).
#
# Prints one fixture name per line, sorted. Used by run-suite.sh, but standalone
# so you can see what a selection resolves to before spending money on a run:
#
#   scripts/select-fixtures.sh --tag agents
#   scripts/select-fixtures.sh --mode dynamo
#   scripts/select-fixtures.sh --tag correctness --automated
#   scripts/select-fixtures.sh --changed-files - --automated --graded
#   git -C ../mergewatch.ai diff --name-only main... \
#     | scripts/select-fixtures.sh --changed-files -
#
# --automated / --manual filter on MANUAL_ONLY and AND with the other filters,
# so `--tag correctness --automated` is the runnable half of the gate. They are
# derived from MANUAL_ONLY rather than being tags of their own: a fixture's
# automatability is already recorded in meta.env, and a second copy in TAGS
# would be free to drift from it.
#
# Exits 2 on an unknown tag or mode — a filter that silently matches nothing
# would look identical to "nothing was impacted", which is the one answer this
# must never give by accident.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
MAP="$REPO_ROOT/e2e/impact-map.yml"

TAGS=(); MODES=(); CHANGED=""; EXPLAIN="${EXPLAIN:-0}"; AUTOMATION=""; GRADING=""

while [ $# -gt 0 ]; do
  case "$1" in
    --tag)           TAGS+=("$2"); shift 2 ;;
    --mode)          MODES+=("$2"); shift 2 ;;
    --changed-files) CHANGED="$2"; shift 2 ;;
    --automated)     AUTOMATION="automated"; shift ;;
    --manual)        AUTOMATION="manual"; shift ;;
    --graded)        GRADING="graded"; shift ;;
    --ungraded)      GRADING="ungraded"; shift ;;
    --explain)       EXPLAIN=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

# --- fixture metadata -------------------------------------------------------
fixture_field() {  # <fixture> <KEY>
  local meta="$REPO_ROOT/fixtures/$1/meta.env"
  [ -f "$meta" ] || return 0
  grep -E "^$2=" "$meta" | head -1 | cut -d= -f2- | tr -d '\r'
}

is_manual() { [ "$(fixture_field "$1" MANUAL_ONLY)" = "true" ]; }

# Keeps or drops one fixture by --automated / --manual. No filter set keeps all.
automation_ok() {
  case "$AUTOMATION" in
    "")        return 0 ;;
    automated) is_manual "$1" && return 1 || return 0 ;;
    manual)    is_manual "$1" && return 0 || return 1 ;;
  esac
}

is_graded() { [ -f "$REPO_ROOT/fixtures/$1/expect.json" ]; }

# Keeps or drops one fixture by --graded / --ungraded.
#
# An ungraded fixture has no expect.json, so grade-run.mjs reports it UNGRADED
# and exits 0 for it — it can never fail. Running one inside a blocking gate
# costs a real PR and a real LLM review to assert nothing, so the gate selects
# --graded and the cost tracks the verification actually obtained.
grading_ok() {
  case "$GRADING" in
    "")       return 0 ;;
    graded)   is_graded "$1" && return 0 || return 1 ;;
    ungraded) is_graded "$1" && return 1 || return 0 ;;
  esac
}

ALL_FIXTURES=()
while IFS= read -r fx; do [ -n "$fx" ] && ALL_FIXTURES+=("$fx"); done < <(ls -1 fixtures | sort)

# Reject filters that match no fixture, rather than returning an empty set.
known_tag() {
  local t
  for f in "${ALL_FIXTURES[@]}"; do
    for t in $(fixture_field "$f" TAGS | tr ',' ' '); do
      [ "$t" = "$1" ] && return 0
    done
  done
  return 1
}
known_mode() {
  for f in "${ALL_FIXTURES[@]}"; do
    [ "$(fixture_field "$f" MODE)" = "$1" ] && return 0
  done
  return 1
}

for t in "${TAGS[@]:-}"; do
  [ -z "$t" ] && continue
  known_tag "$t" || { echo "unknown tag: $t" >&2; exit 2; }
done
for m in "${MODES[@]:-}"; do
  [ -z "$m" ] && continue
  known_mode "$m" || { echo "unknown mode: $m" >&2; exit 2; }
done

# --- changed paths -> tags --------------------------------------------------
# Returns 0 and prints tags; prints the literal token ALL when the whole suite
# is required (an explicit ALL entry, or a path no rule covers).
resolve_changed_tags() {
  local src="$1" line path globs tags matched any_path=0
  [ -f "$MAP" ] || { echo "ALL"; return 0; }

  local out=""
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    any_path=1
    matched=0
    # First matching rule wins.
    while IFS= read -r line; do
      case "$line" in ''|'#'*) continue ;; esac
      globs="${line%%:*}"
      tags="${line#*:}"
      tags="$(echo "$tags" | tr -d '[]' | tr -d ' ')"
      # shellcheck disable=SC2254
      case "$path" in
        $globs) matched=1
                [ -n "$tags" ] && out="$out,$tags"
                break ;;
      esac
    done < "$MAP"
    if [ "$matched" -eq 0 ]; then
      [ "$EXPLAIN" = "1" ] && echo "unmapped path forces full suite: $path" >&2
      echo "ALL"; return 0
    fi
  done < <(if [ "$src" = "-" ]; then cat; else cat "$src"; fi)

  [ "$any_path" -eq 0 ] && { echo ""; return 0; }
  echo "$out" | tr ',' '\n' | grep -v '^$' | sort -u | tr '\n' ' '
}

if [ -n "$CHANGED" ]; then
  RESOLVED="$(resolve_changed_tags "$CHANGED")"
  if echo "$RESOLVED" | grep -qw ALL; then
    # Still honour --automated/--manual: "everything is impacted" is a statement
    # about scope, not about which fixtures can actually run unattended.
    for f in "${ALL_FIXTURES[@]}"; do
      automation_ok "$f" && grading_ok "$f" && echo "$f"
    done
    exit 0
  fi
  # No tags at all means nothing relevant changed — an empty selection here is
  # a real answer, not a filter mistake.
  if [ -z "$(echo "$RESOLVED" | tr -d ' ')" ]; then
    exit 0
  fi
  for t in $RESOLVED; do TAGS+=("$t"); done
fi

# --- apply filters ----------------------------------------------------------
if [ "${#TAGS[@]}" -eq 0 ] && [ "${#MODES[@]}" -eq 0 ]; then
  for f in "${ALL_FIXTURES[@]}"; do
    automation_ok "$f" && grading_ok "$f" && echo "$f"
  done
  exit 0
fi

for f in "${ALL_FIXTURES[@]}"; do
  keep=1
  if [ "${#TAGS[@]}" -gt 0 ]; then
    keep=0
    ftags=" $(fixture_field "$f" TAGS | tr ',' ' ') "
    for t in "${TAGS[@]}"; do
      case "$ftags" in *" $t "*) keep=1; break ;; esac
    done
  fi
  if [ "$keep" -eq 1 ] && [ "${#MODES[@]}" -gt 0 ]; then
    keep=0
    fmode="$(fixture_field "$f" MODE)"
    for m in "${MODES[@]}"; do
      [ "$fmode" = "$m" ] && { keep=1; break; }
    done
  fi
  if [ "$keep" -eq 1 ] && automation_ok "$f" && grading_ok "$f"; then echo "$f"; fi
done

# A selection that legitimately matches nothing is not an error; unknown tags and
# modes already exited 2 above. Without this, a filtered-out LAST fixture leaves
# the loop's non-zero status as the script's, and every caller reads it as failure.
exit 0
