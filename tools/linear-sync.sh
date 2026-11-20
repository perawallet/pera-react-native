#!/usr/bin/env bash
# GraphQL variables and jq bindings are $-prefixed and must stay unexpanded.
# shellcheck disable=SC2016
set -uo pipefail

# tools/linear-sync.sh <target-status> [text...]
#
# Moves Linear issues of one team to a target workflow state, optionally
# assigning them. Shared by .github/workflows/linear-sync.yml (branch pushed /
# PR opened / PR closed unmerged) and .github/workflows/linear-release-sync.yml
# (nightly, rc and store releases), so the rules for talking to Linear live in
# one place.
#
# Arguments are scanned for <TEAM>-<digits> tokens, so whole branch names, PR
# titles or commit subjects can be passed verbatim; anything else is ignored.
#
# Env:
#   LINEAR_API_KEY         required — a personal API key (sent without "Bearer")
#   LINEAR_TEAM_KEY        default PER — the only team this may touch
#   LINEAR_ASSIGNEE        optional — username (Linear's displayName, e.g.
#                          eric.wollaeger) of an active user to assign when the
#                          issue moves; zero or several matches skip the
#                          assignment
#   LINEAR_PARKED_STATUSES default Blocked — comma-separated states that are a
#                          deliberate park, never moved out of
#   LINEAR_ONLY_FROM_STATUSES optional — comma-separated states to act on,
#                          skipping every other
#   LINEAR_MIN_FROM_STATUS optional — act only on issues at this state or later
#   LINEAR_ALLOW_BACKWARD  when "1": the target may be behind the current state;
#                          pair it with LINEAR_ONLY_FROM_STATUSES
#   LINEAR_THROTTLE_SECONDS optional — pause between issues (default 0.1)
#   DRY_RUN                when "1": read and report, but withhold every write
#
# Deliberately exits 0 even when individual issues fail: ticket bookkeeping must
# never break a push, a merge, or a release build. Problems surface as GitHub
# Actions warning annotations.
#
# No `set -x` anywhere below — the trace would print the API key.

TARGET_STATUS="${1:-}"
if [ -z "$TARGET_STATUS" ]; then
    echo "linear-sync: missing target status argument" >&2
    exit 2
fi
shift

if [ -z "${LINEAR_API_KEY:-}" ]; then
    echo "::warning::linear-sync: LINEAR_API_KEY is not set — skipping Linear sync"
    exit 0
fi

TEAM_KEY="${LINEAR_TEAM_KEY:-PER}"
LINEAR_API_URL="${LINEAR_API_URL:-https://api.linear.app/graphql}"

if [ "$#" -eq 0 ]; then
    echo "linear-sync: no issues given — nothing to do"
    exit 0
fi

degraded=0

# Prints the response body followed by a final line holding the HTTP status.
# Mutations do not retry: a timed-out write may already have applied.
gql() { # $1 query  $2 variables json  $3 "write" to disable retries
    local -a args=(
        -sS -w '\n%{http_code}' --max-time 30 -X POST
        -H "Authorization: ${LINEAR_API_KEY}" -H 'Content-Type: application/json'
        --data "$(jq -nc --arg q "$1" --argjson v "$2" '{query: $q, variables: $v}')"
    )
    if [ "${3:-}" != "write" ]; then
        args+=(--retry 2)
    fi
    curl "${args[@]}" "$LINEAR_API_URL" 2>&1
}

code_of() { printf '%s' "${1##*$'\n'}"; }
body_of() { printf '%s' "${1%$'\n'*}"; }

# GraphQL reports most failures as HTTP 200 with an `errors` array.
gql_ok() { # $1 response
    [ "$(code_of "$1")" = "200" ] &&
        [ "$(body_of "$1" | jq -r 'if .errors then "err" else "ok" end' 2>/dev/null)" = "ok" ]
}

# The boundary keeps `super-12` from reading as PER-12; `pera-1` never matches
# because the letter after PER is not a dash.
KEYS=$(printf '%s\n' "$@" |
    grep -oiE "(^|[^A-Za-z0-9])${TEAM_KEY}-[0-9]+" |
    grep -oE '[A-Za-z]+-[0-9]+' |
    tr '[:lower:]' '[:upper:]' |
    sort -u)
if [ -z "$KEYS" ]; then
    echo "linear-sync: no ${TEAM_KEY} keys resolved — nothing to do"
    exit 0
fi

ASSIGNEE_ID=""
# The username, not the full name: names are free text ("Eric") and collide,
# while displayName is unique within the workspace.
if [ -n "${LINEAR_ASSIGNEE:-}" ]; then
    resp=$(gql 'query($name: String!) { users(filter: { displayName: { eqIgnoreCase: $name }, active: { eq: true } }) { nodes { id } } }' \
        "$(jq -nc --arg name "$LINEAR_ASSIGNEE" '{name: $name}')")
    if gql_ok "$resp"; then
        matches=$(body_of "$resp" | jq -r '.data.users.nodes | length')
        if [ "$matches" = "1" ]; then
            ASSIGNEE_ID=$(body_of "$resp" | jq -r '.data.users.nodes[0].id')
        else
            echo "::warning::linear-sync: ${matches} active users with username '${LINEAR_ASSIGNEE}' — skipping assignment"
            degraded=1
        fi
    else
        echo "::warning::linear-sync: could not look up '${LINEAR_ASSIGNEE}' (HTTP $(code_of "$resp")) — skipping assignment"
        degraded=1
    fi
fi

ISSUE_QUERY='query($id: String!) {
  issue(id: $id) {
    id identifier
    assignee { id }
    state { name }
    team { key states { nodes { id name type position } } }
  }
}'

# Forward-only ranks the team's own states: by type (backlog, unstarted,
# started, completed), then by board position. Triage, canceled-type and parked
# states are not positions in the flow, so they get no rank and are never moved
# out of or into. Blocked must be parked by name: Linear types it "started" and
# places it after In QA, so ranking it would read as past In QA.
RANK_JQ='
  {"backlog":0,"unstarted":1,"started":2,"completed":3} as $order
  | ($parked | split(",")) as $parked
  | [.data.issue.team.states.nodes[]
     | select($order[.type] != null and (.name as $n | $parked | index($n) | not))
     | . + {o: $order[.type]}]
  | sort_by(.o, .position)
  | map(.name)
  | index($name) // empty'

PARKED="${LINEAR_PARKED_STATUSES-Blocked}"

UPDATE_MUTATION='mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }'

first_issue=yes
for key in $KEYS; do
    if [ -z "$first_issue" ]; then
        sleep "${LINEAR_THROTTLE_SECONDS:-0.1}"
    fi
    first_issue=

    resp=$(gql "$ISSUE_QUERY" "$(jq -nc --arg id "$key" '{id: $id}')")
    issue=$(body_of "$resp")
    current=$(jq -r '.data.issue.state.name // empty' <<<"$issue" 2>/dev/null)
    if ! gql_ok "$resp" || [ -z "$current" ]; then
        echo "::warning::${key}: could not read issue (HTTP $(code_of "$resp")) — skipped"
        degraded=1
        continue
    fi

    # Linear resolves an old identifier to an issue that has since moved teams,
    # so the key prefix alone does not prove the issue is still ours.
    team=$(jq -r '.data.issue.team.key' <<<"$issue")
    if [ "$team" != "$TEAM_KEY" ]; then
        echo "${key}: now in team ${team} — left alone"
        continue
    fi

    if ! current_rank=$(jq -re --arg name "$current" --arg parked "$PARKED" "$RANK_JQ" <<<"$issue" 2>/dev/null); then
        echo "${key}: '${current}' is outside the pipeline — left alone"
        continue
    fi
    if ! target_rank=$(jq -re --arg name "$TARGET_STATUS" --arg parked "$PARKED" "$RANK_JQ" <<<"$issue" 2>/dev/null); then
        echo "::warning::${key}: team ${team} has no state '${TARGET_STATUS}' — skipped"
        degraded=1
        continue
    fi
    if [ "$target_rank" -lt "$current_rank" ] && [ "${LINEAR_ALLOW_BACKWARD:-}" != "1" ]; then
        echo "${key}: '${current}' is already past '${TARGET_STATUS}' — left alone"
        continue
    fi

    # Forward is necessary but not always sufficient: a store release closes
    # only what QA has, never work still in development or review.
    if [ -n "${LINEAR_MIN_FROM_STATUS:-}" ]; then
        if ! min_rank=$(jq -re --arg name "$LINEAR_MIN_FROM_STATUS" --arg parked "$PARKED" "$RANK_JQ" <<<"$issue" 2>/dev/null); then
            echo "::warning::${key}: team ${team} has no state '${LINEAR_MIN_FROM_STATUS}' — skipped"
            degraded=1
            continue
        fi
        if [ "$current_rank" -lt "$min_rank" ]; then
            echo "${key}: in '${current}', before '${LINEAR_MIN_FROM_STATUS}' — left alone"
            continue
        fi
    fi
    if [ -n "${LINEAR_ONLY_FROM_STATUSES:-}" ]; then
        case ",${LINEAR_ONLY_FROM_STATUSES}," in
            *",${current},"*) ;;
            *)
                echo "${key}: in '${current}', not '${LINEAR_ONLY_FROM_STATUSES}' — left alone"
                continue
                ;;
        esac
    fi

    # Assigning only alongside a move: an rc re-delivers what a nightly already
    # handed to QA, and must not undo QA passing the ticket back to its developer.
    if [ "$current" = "$TARGET_STATUS" ]; then
        echo "${key}: already '${TARGET_STATUS}'"
        continue
    fi
    state_id=$(jq -r --arg name "$TARGET_STATUS" \
        'first(.data.issue.team.states.nodes[] | select(.name == $name) | .id)' <<<"$issue")
    input=$(jq -nc --arg s "$state_id" '{stateId: $s}')
    if [ -n "$ASSIGNEE_ID" ] && [ "$(jq -r '.data.issue.assignee.id // empty' <<<"$issue")" != "$ASSIGNEE_ID" ]; then
        input=$(jq -c --arg a "$ASSIGNEE_ID" '. + {assigneeId: $a}' <<<"$input")
    fi

    if [ "${DRY_RUN:-}" = "1" ]; then
        echo "  would update ${key} ${input}" >&2
        ok=yes
    else
        resp=$(gql "$UPDATE_MUTATION" \
            "$(jq -nc --arg id "$key" --argjson input "$input" '{id: $id, input: $input}')" write)
        ok=$(gql_ok "$resp" && body_of "$resp" | jq -r 'if .data.issueUpdate.success then "yes" else empty end' 2>/dev/null)
    fi
    if [ "$ok" != "yes" ]; then
        echo "::warning::${key}: update failed (HTTP $(code_of "$resp"))"
        degraded=1
        continue
    fi
    echo "${key}: '${current}' → '${TARGET_STATUS}'"
    if jq -e '.assigneeId' <<<"$input" >/dev/null; then
        echo "${key}: assigned to ${LINEAR_ASSIGNEE}"
    fi
done

if [ "$degraded" = "1" ]; then
    echo "linear-sync: finished with warnings (not failing the build)"
fi
exit 0
