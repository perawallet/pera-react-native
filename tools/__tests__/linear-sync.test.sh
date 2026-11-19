#!/usr/bin/env bash
set -uo pipefail

# Exercises tools/linear-sync.sh against a stubbed Linear GraphQL API. The script
# only runs unattended in CI, exits 0 on every failure path and writes to a live
# tracker, so a regression would otherwise surface as tickets quietly not moving,
# or moving when they should not.

TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# Stands in for curl, mirroring its `-w '\n%{http_code}'` output contract and
# routing on the GraphQL operation in the request body. Every mutation is
# appended to $STUB_WRITES so cases can assert that nothing was written.
mkdir -p "$WORK/bin"
cat >"$WORK/bin/curl" <<'STUB'
#!/usr/bin/env bash
body=""
while [ $# -gt 0 ]; do
    case "$1" in
        --data) body="$2"; shift 2 ;;
        *) shift ;;
    esac
done
emit() { printf '%s\n%s' "$1" "$2"; }
query=$(jq -r '.query' <<<"$body")
case "$query" in
    *issueUpdate*)
        jq -c '.variables' <<<"$body" >>"$STUB_WRITES"
        emit "{\"data\":{\"issueUpdate\":{\"success\":${STUB_UPDATE_SUCCESS:-true}}}}" "${STUB_UPDATE_CODE:-200}"
        ;;
    *users*)
        nodes=$(jq -nc --argjson n "${STUB_USERS:-1}" '[range($n) | {id: "user-\(.)"}]')
        emit "{\"data\":{\"users\":{\"nodes\":${nodes}}}}" 200
        ;;
    *issue*)
        if [ -n "${STUB_ISSUE_ERRORS:-}" ]; then
            emit '{"errors":[{"message":"Entity not found"}],"data":null}' 200
            exit 0
        fi
        states='[
          {"id":"s-backlog","name":"Backlog","type":"backlog","position":0},
          {"id":"s-todo","name":"Todo","type":"unstarted","position":0},
          {"id":"s-review","name":"In Code Review","type":"started","position":2},
          {"id":"s-progress","name":"In Progress","type":"started","position":1},
          {"id":"s-qa","name":"In QA","type":"started","position":3},
          {"id":"s-blocked","name":"Blocked","type":"started","position":4},
          {"id":"s-done","name":"Done","type":"completed","position":0},
          {"id":"s-canceled","name":"Canceled","type":"canceled","position":0},
          {"id":"s-duplicate","name":"Duplicate","type":"canceled","position":1},
          {"id":"s-triage","name":"Triage","type":"triage","position":0}
        ]'
        jq -nc --arg id "$(jq -r '.variables.id' <<<"$body")" \
            --arg state "${STUB_STATE:-In Progress}" --arg team "${STUB_TEAM:-PER}" \
            --arg assignee "${STUB_ASSIGNEE:-}" --argjson states "$states" \
            '{data: {issue: {id: "uuid", identifier: $id,
              assignee: (if $assignee == "" then null else {id: $assignee} end),
              state: {name: $state}, team: {key: $team, states: {nodes: $states}}}}}' |
            { read -r out; emit "$out" "${STUB_ISSUE_CODE:-200}"; }
        ;;
    *) emit '{"errors":[{"message":"unrouted"}]}' 500 ;;
esac
STUB
chmod +x "$WORK/bin/curl"

export PATH="$WORK/bin:$PATH"
export LINEAR_API_KEY=key
export LINEAR_THROTTLE_SECONDS=0
export STUB_WRITES="$WORK/writes.log"

failures=0
# Asserts on the combined output (every path exits 0) and on what was written.
# $4 is a jq filter over the written mutation variables ('' expects no write).
expect() { # $1 label  $2 must-contain  $3 must-NOT-contain ('' to skip)  $4 write filter  rest: env=val... -- args...
    local label="$1" want="$2" avoid="$3" written="$4" out
    shift 4
    local -a env_args=()
    while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do
        env_args+=("$1")
        shift
    done
    shift || true
    : >"$STUB_WRITES"
    # The +-guard: bash 3.2 under `set -u` rejects an empty "${arr[@]}".
    out=$(env ${env_args[@]+"${env_args[@]}"} "${TOOLS}/linear-sync.sh" "$@" 2>&1)
    if ! grep -qF -- "$want" <<<"$out"; then
        echo "  FAIL  ${label}: expected to see '${want}'"
        printf '        got: %s\n' "$out"
        failures=$((failures + 1))
        return
    fi
    if [ -n "$avoid" ] && grep -qF -- "$avoid" <<<"$out"; then
        echo "  FAIL  ${label}: did not expect '${avoid}'"
        printf '        got: %s\n' "$out"
        failures=$((failures + 1))
        return
    fi
    if [ -z "$written" ]; then
        if [ -s "$STUB_WRITES" ]; then
            echo "  FAIL  ${label}: expected no write, got $(cat "$STUB_WRITES")"
            failures=$((failures + 1))
            return
        fi
    elif ! jq -se "$written" "$STUB_WRITES" >/dev/null 2>&1; then
        echo "  FAIL  ${label}: write did not satisfy '${written}': $(cat "$STUB_WRITES")"
        failures=$((failures + 1))
        return
    fi
    echo "  ok    ${label}"
}

expect "a first branch push moves the ticket to In Progress" \
    "'Todo' → 'In Progress'" "" \
    '.[0] == {id: "PER-12", input: {stateId: "s-progress"}}' \
    STUB_STATE=Todo -- "In Progress" "fmota/per-12-some-feature"

expect "an opened PR moves the ticket to In Review" \
    "'In Progress' → 'In Code Review'" "" \
    '.[0].input == {stateId: "s-review"}' \
    -- "In Code Review" "feat(x): thing [PER-12]" "fmota/per-12"

expect "a merge moves the ticket to In QA and assigns QA" \
    "assigned to eric.wollaeger" "" \
    '.[0].input == {stateId: "s-qa", assigneeId: "user-0"}' \
    STUB_STATE="In Code Review" LINEAR_ASSIGNEE=eric.wollaeger -- "In QA" "[PER-12]"

expect "a stable release closes a ticket in QA" \
    "'In QA' → 'Done'" "" \
    '.[0].input == {stateId: "s-done"}' \
    STUB_STATE="In QA" LINEAR_ONLY_FROM_STATUSES="In QA" -- "Done" "PER-12"

# The store-release guard: shipping must not close what QA has not had.
expect "a stable release does not close a ticket still in review" \
    "not 'In QA' — left alone" "" '' \
    STUB_STATE="In Code Review" LINEAR_ONLY_FROM_STATUSES="In QA" -- "Done" "PER-12"

expect "a stable release does not close a ticket still in progress" \
    "not 'In QA' — left alone" "" '' \
    LINEAR_ONLY_FROM_STATUSES="In QA" -- "Done" "PER-12"

expect "lowercase keys and duplicates collapse to one issue" \
    "PER-12:" "" \
    'length == 1' \
    -- "In Code Review" "per-12 PER-12 yasince/fix/PER-12"

# Pera only: Jira's PERA keys and other teams' keys are not candidates.
expect "a Jira PERA key is not a Linear key" \
    "no PER keys resolved" "" '' \
    -- "In Code Review" "mitsinsar/pera-6350-signing [PERA-6350]"

expect "PER inside a longer word is not a key" \
    "no PER keys resolved" "" '' \
    -- "In Code Review" "fix: super-12 rendering"

expect "an issue that moved to another team is left alone" \
    "now in team BE — left alone" "" '' \
    STUB_TEAM=BE -- "In Code Review" "[PER-12]"

expect "text with no ticket key is a no-op" \
    "no PER keys resolved" "" '' \
    -- "In Code Review" "ci: shard the test job (#1089)"

expect "a missing API key skips instead of failing" \
    "LINEAR_API_KEY is not set" "" '' \
    LINEAR_API_KEY= -- "In Code Review" "[PER-12]"

expect "an unreadable issue is skipped, not fatal" \
    "could not read issue (HTTP 500)" "" '' \
    STUB_ISSUE_CODE=500 -- "In Code Review" "[PER-12]"

expect "a GraphQL error on read is skipped, not fatal" \
    "could not read issue" "" '' \
    STUB_ISSUE_ERRORS=1 -- "In Code Review" "[PER-12]"

expect "a target state the team does not have is skipped" \
    "has no state 'In Review'" "" '' \
    -- "In Review" "[PER-12]"

expect "a failed update is reported, not fatal" \
    "update failed" "→" \
    'length == 1' \
    STUB_UPDATE_SUCCESS=false -- "In Code Review" "[PER-12]"

# Forward-only: automation advances work and never undoes a person's decision.
expect "a branch push does not demote a ticket already in review" \
    "already past 'In Progress'" "" '' \
    STUB_STATE="In Code Review" -- "In Progress" "[PER-12]"

expect "a merge does not reopen a closed ticket" \
    "already past 'In QA'" "assigned" '' \
    STUB_STATE=Done LINEAR_ASSIGNEE=eric.wollaeger -- "In QA" "[PER-12]"

expect "a canceled ticket is left alone" \
    "outside the pipeline" "" '' \
    STUB_STATE=Canceled -- "Done" "[PER-12]"

expect "a duplicate is left alone" \
    "outside the pipeline" "" '' \
    STUB_STATE=Duplicate -- "In Code Review" "[PER-12]"

# Linear types Blocked as "started" and places it after In QA; ranked, it would
# read as past In QA and a merge would leave it, but a release would close it.
expect "a blocked ticket is left alone by a merge" \
    "outside the pipeline" "" '' \
    STUB_STATE=Blocked -- "In QA" "[PER-12]"

expect "a blocked ticket is left alone by a branch push" \
    "outside the pipeline" "" '' \
    STUB_STATE=Blocked -- "In Progress" "[PER-12]"

expect "no ticket is moved into Blocked" \
    "has no state 'Blocked'" "" '' \
    -- "Blocked" "[PER-12]"

expect "a triage ticket is left alone" \
    "outside the pipeline" "" '' \
    STUB_STATE=Triage -- "In Progress" "[PER-12]"

expect "a ticket QA pushed back is advanced again by the next merge" \
    "'In Progress' → 'In QA'" "" \
    '.[0].input.stateId == "s-qa"' \
    -- "In QA" "[PER-12]"

expect "a ticket already in the target is assigned without a state change" \
    "assigned to eric.wollaeger" "→" \
    '.[0].input == {assigneeId: "user-0"}' \
    STUB_STATE="In QA" LINEAR_ASSIGNEE=eric.wollaeger -- "In QA" "[PER-12]"

expect "a ticket already in the target and already assigned is not written" \
    "already 'In QA'" "" '' \
    STUB_STATE="In QA" STUB_ASSIGNEE=user-0 LINEAR_ASSIGNEE=eric.wollaeger -- "In QA" "[PER-12]"

expect "an ambiguous assignee still moves the ticket" \
    "2 active users with username 'eric.wollaeger'" "assigned" \
    '.[0].input == {stateId: "s-qa"}' \
    STUB_STATE="In Code Review" STUB_USERS=2 LINEAR_ASSIGNEE=eric.wollaeger -- "In QA" "[PER-12]"

expect "an unknown assignee still moves the ticket" \
    "0 active users with username" "assigned" \
    '.[0].input == {stateId: "s-qa"}' \
    STUB_STATE="In Code Review" STUB_USERS=0 LINEAR_ASSIGNEE=nobody -- "In QA" "[PER-12]"

expect "dry run reports without writing" \
    "would update PER-12" "" '' \
    DRY_RUN=1 -- "In Code Review" "[PER-12]"

expect "a release moves every delivered ticket" \
    "PER-2: 'In Progress' → 'Done'" "" \
    'length == 2' \
    -- "Done" "PER-1" "PER-2"

if [ "$failures" -gt 0 ]; then
    echo "linear-sync: ${failures} failure(s)"
    exit 1
fi
echo "linear-sync: all checks passed"
