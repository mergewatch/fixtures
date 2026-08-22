#!/usr/bin/env bash
# Resolve a fixture selection from tags, modes, or a set of changed paths (#416).
#
# Prints one fixture name per line, sorted. Used by run-suite.sh, but standalone
# so you can see what a selection resolves to before spending money on a run:
#
#   scripts/select-fixtures.sh --tag agents
#   scripts/select-fixtures.sh --mode dynamo
#   git -C ../mergewatch.ai diff --name-only main... \
#     | scripts/select-fixtures.sh --changed-files -
#
# Exits 2 on an unknown tag or mode — a filter that silently matches nothing
# would look identical to "nothing was impacted", which is the one answer this
# must never give by accident.
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
MAP="$REPO_ROOT/e2e/impact-map.yml"

TAGS=(); MODES=(); CHANGED=""; EXPLAIN="${EXPLAIN:-0}"

while [ $# -gt 0 ]; do
  case "$1" in
    --tag)           TAGS+=("$2"); shift 2 ;;
    --mode)          MODES+=("$2"); shift 2 ;;
    --changed-files) CHANGED="$2"; shift 2 ;;
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
    printf '%s\n' "${ALL_FIXTURES[@]}"
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
  printf '%s\n' "${ALL_FIXTURES[@]}"
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
  [ "$keep" -eq 1 ] && echo "$f"
done
