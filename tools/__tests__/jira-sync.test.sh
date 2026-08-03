#!/usr/bin/env bash
set -uo pipefail

# Exercises tools/jira-sync.sh against a stubbed Jira API. Every branch here has
# no other coverage: the script only ever runs unattended in CI, it is written to
# exit 0 on every failure path, and it writes to a live tracker — so a regression
# would otherwise surface as tickets quietly not moving, or moving when they
# should not.

TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

TRANSITIONS='{"transitions":[{"id":"6","to":{"name":"In Code Review"}},{"id":"7","to":{"name":"Ready for QA"}},{"id":"31","to":{"name":"Done"}}]}'

# Stands in for curl, mirroring its `-w '\n%{http_code}'` output contract.
mkdir -p "$WORK/bin"
cat >"$WORK/bin/curl" <<'STUB'
#!/usr/bin/env bash
url=""; method="GET"; jql=""
while [ $# -gt 0 ]; do
    case "$1" in
        -X) method="$2"; shift 2 ;;
        --data-urlencode) case "$2" in jql=*) jql="${2#jql=}" ;; esac; shift 2 ;;
        http://* | https://*) url="$1"; shift ;;
        *) shift ;;
    esac
done
emit() { printf '%s\n%s' "$1" "$2"; }
case "${method} ${url}" in
    "GET "*/search/jql)
        case "$jql" in
            *"key in ("*) emit "${STUB_SCOPE:-{\"issues\":[]\}}" "${STUB_SCOPE_CODE:-200}" ;;
            *) emit "${STUB_SEARCH:-{\"issues\":[]\}}" "${STUB_SEARCH_CODE:-200}" ;;
        esac
        ;;
    "GET "*/versions)
        # With a counter set, the first list is empty and later ones are not —
        # a concurrent build creating the version between our list and our create.
        if [ -n "${STUB_VERSIONS_COUNTER:-}" ]; then
            seen=$(cat "$STUB_VERSIONS_COUNTER" 2>/dev/null || echo 0)
            echo $((seen + 1)) >"$STUB_VERSIONS_COUNTER"
            [ "$seen" = "0" ] && emit '[]' 200 || emit "${STUB_VERSIONS:-[]}" 200
        else
            emit "${STUB_VERSIONS:-[]}" 200
        fi
        ;;
    "POST "*/version) emit '{}' "${STUB_VERSION_CREATE_CODE:-201}" ;;
    "GET "*/transitions) emit "${STUB_TRANSITIONS:-}" 200 ;;
    "POST "*/transitions) emit "" "${STUB_TRANSITION_CODE:-204}" ;;
    "PUT "*/assignee) emit "" 204 ;;
    "PUT "*/issue/*) emit "" 204 ;;
    "GET "*/issue/*)
        emit "{\"fields\":{\"status\":{\"name\":\"${STUB_STATUS:-In Progress}\"},\"fixVersions\":${STUB_FIXVERSIONS:-[]}}}" \
            "${STUB_ISSUE_CODE:-200}"
        ;;
    *) emit '{"error":"unrouted"}' 500 ;;
esac
STUB
chmod +x "$WORK/bin/curl"

export PATH="$WORK/bin:$PATH"
export JIRA_BASE_URL=https://example.atlassian.net
export JIRA_USER_EMAIL=ci@example.com
export JIRA_API_TOKEN=token
export STUB_TRANSITIONS="$TRANSITIONS"
# Unscoped by default: an unset JIRA_SCOPE_JQL takes the real board filter from
# tools/lib/jira-api.sh, and the stub answers every board lookup with an empty
# list — which would drop every key before the cases below reach a transition.
# Empty means "no scoping"; the board-scope cases set it explicitly.
export JIRA_SCOPE_JQL=""

failures=0
# Asserts on the combined output, since every path is designed to exit 0.
expect() { # $1 label  $2 must-contain  $3 must-NOT-contain ('' to skip)  rest: env=val... -- args...
    local label="$1" want="$2" avoid="$3" out
    shift 3
    local -a env_args=()
    while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do
        env_args+=("$1")
        shift
    done
    shift || true
    out=$(env "${env_args[@]}" "${TOOLS}/jira-sync.sh" "$@" 2>&1)
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
    echo "  ok    ${label}"
}

expect "transitions a ticket named in a commit subject" \
    "'In Progress' → 'In Code Review'" "" \
    DRY_RUN=1 -- "In Code Review" "fix(x): thing [PERA-1]"

expect "reassigns without a redundant transition when already in target" \
    "assignee set" "→" \
    DRY_RUN=1 STUB_STATUS="In Code Review" JIRA_ASSIGNEE_ACCOUNT_ID=acct -- \
    "In Code Review" "[PERA-1]"

expect "lowercase keys and duplicates collapse to one issue" \
    "PERA-1:" "" \
    DRY_RUN=1 -- "In Code Review" "pera-1 PERA-1 pera-1"

expect "text with no ticket key is a no-op" \
    "no PERA keys resolved" "would" \
    DRY_RUN=1 -- "In Code Review" "ci: shard the test job (#1089)"

expect "a missing secret skips instead of failing" \
    "JIRA_API_TOKEN is not set" "" \
    DRY_RUN=1 JIRA_API_TOKEN= -- "In Code Review" "[PERA-1]"

expect "an unreadable issue is skipped, not fatal" \
    "could not read issue (HTTP 404)" "" \
    DRY_RUN=1 STUB_ISSUE_CODE=404 -- "In Code Review" "[PERA-1]"

expect "a target with no available transition is skipped" \
    "no transition to 'In Beta'" "" \
    DRY_RUN=1 -- "In Beta" "[PERA-1]"

expect "skip-statuses leaves finished work alone" \
    "in 'Done' — left alone" "would" \
    DRY_RUN=1 STUB_STATUS=Done JIRA_SKIP_STATUSES="Done,Cancelled,Duplicate" -- \
    "Ready for QA" "[PERA-1]"

# The store-release guard: shipping must not close what QA still has open.
expect "only-from refuses to close a ticket still in QA" \
    "not 'Waiting for Deployment' — left alone" "would" \
    DRY_RUN=1 STUB_STATUS="In QA" JIRA_ONLY_FROM_STATUSES="Waiting for Deployment" -- \
    "Done" "[PERA-1]"

expect "only-from closes a ticket parked for deployment" \
    "'Waiting for Deployment' → 'Done'" "" \
    DRY_RUN=1 STUB_STATUS="Waiting for Deployment" JIRA_ONLY_FROM_STATUSES="Waiting for Deployment" -- \
    "Done" "[PERA-1]"

# Forward-only is the core invariant: automation advances work up the pipeline and
# never back down it. Each case below was a real backwards move before it existed,
# and none of them needs any per-stage configuration to be safe.
expect "a build advances a ticket that is behind it" \
    "'In Code Review' → 'Ready for QA'" "" \
    DRY_RUN=1 STUB_STATUS="In Code Review" -- "Ready for QA" "[PERA-1]"

expect "a build does not undo QA's sign-off" \
    "already past 'Ready for QA'" "would" \
    DRY_RUN=1 STUB_STATUS="Waiting for Deployment" -- "Ready for QA" "[PERA-1]"

expect "a build does not reset a ticket under test" \
    "already past 'Ready for QA'" "would" \
    DRY_RUN=1 STUB_STATUS="In QA" -- "Ready for QA" "[PERA-1]"

expect "a build does not walk a released ticket backwards" \
    "already past 'Ready for QA'" "would" \
    DRY_RUN=1 STUB_STATUS="In Beta" -- "Ready for QA" "[PERA-1]"

expect "a merge does not reopen a closed ticket" \
    "already past 'In Code Review'" "would" \
    DRY_RUN=1 STUB_STATUS="Done" -- "In Code Review" "[PERA-1]"

expect "a branch push does not demote a ticket already in review" \
    "already past 'In Progress'" "would" \
    DRY_RUN=1 STUB_STATUS="In Code Review" -- "In Progress" "[PERA-1]"

# Off-pipeline states are deliberate parks, not positions in the flow.
expect "a blocked ticket is left alone" \
    "outside the pipeline" "would" \
    DRY_RUN=1 STUB_STATUS="Blocked" -- "Ready for QA" "[PERA-1]"

expect "a ticket awaiting product input is left alone" \
    "outside the pipeline" "would" \
    DRY_RUN=1 STUB_STATUS="Product Input Needed" -- "Ready for QA" "[PERA-1]"

expect "a cancelled ticket is left alone" \
    "outside the pipeline" "would" \
    DRY_RUN=1 STUB_STATUS="Cancelled" -- "Ready for QA" "[PERA-1]"

# QA rejecting a ticket lands it back down the pipeline, so the normal
# fix-and-resubmit loop still completes.
expect "a ticket QA pushed back is advanced again by the next build" \
    "'In Progress' → 'Ready for QA'" "" \
    DRY_RUN=1 STUB_STATUS="In Progress" -- "Ready for QA" "[PERA-1]"

# Forward is necessary but not sufficient for the store release: Ready for QA is
# behind Done, yet closing untested work would be wrong.
# A ticket with no commit is never even a candidate: nothing passes it in.
expect "a ticket with no branch, PR or commit is never touched" \
    "no issues given" "would" \
    DRY_RUN=1 -- "Done"

expect "a store release does not close work that skipped QA" \
    "not 'Waiting for Deployment'" "would" \
    DRY_RUN=1 STUB_STATUS="Ready for QA" JIRA_ONLY_FROM_STATUSES="Waiting for Deployment" -- \
    "Done" "[PERA-1]"

# Board scope: keys come from free text, so an off-board ticket must be dropped.
expect "a ticket outside the board scope is left alone" \
    "PERA-2: not on the board" "PERA-2: '" \
    DRY_RUN=1 STUB_SCOPE='{"issues":[{"key":"PERA-1"}]}' JIRA_SCOPE_JQL='project = X' -- \
    "In Code Review" "[PERA-1] and [PERA-2]"

expect "a failed scope check refuses to write anything" \
    "refusing to touch any issue" "would" \
    DRY_RUN=1 STUB_SCOPE_CODE=500 JIRA_SCOPE_JQL='project = X' -- "In Code Review" "[PERA-1]"

expect "an existing fix version is never overwritten" \
    "left as first-fixed" "" \
    DRY_RUN=1 STUB_FIXVERSIONS='[{"name":"v1.0.0-rc.1"}]' STUB_VERSIONS='[{"id":"1","name":"v1.0.0-rc.2"}]' \
    JIRA_FIX_VERSION=v1.0.0-rc.2 JIRA_PROJECT_ID=1 -- "Ready for QA" "[PERA-1]"

expect "an unstamped issue takes the release's fix version" \
    "fix version 'v1.0.0-rc.2'" "" \
    DRY_RUN=1 STUB_VERSIONS='[{"id":"1","name":"v1.0.0-rc.2"}]' \
    JIRA_FIX_VERSION=v1.0.0-rc.2 JIRA_PROJECT_ID=1 -- "Ready for QA" "[PERA-1]"

# Losing the create race must not disable fix versions for the whole run.
expect "a version created concurrently is adopted rather than fatal" \
    "created concurrently" "" \
    DRY_RUN= STUB_VERSION_CREATE_CODE=400 STUB_VERSIONS='[{"id":"1","name":"v1.0.0-rc.2"}]' \
    STUB_VERSIONS_COUNTER="${WORK}/versions.count" \
    JIRA_FIX_VERSION=v1.0.0-rc.2 JIRA_PROJECT_ID=1 -- "Ready for QA" "[PERA-1]"

expect "missing project admin degrades but still transitions" \
    "needs Administer Projects" "" \
    DRY_RUN= STUB_VERSION_CREATE_CODE=403 STUB_VERSIONS='[]' \
    JIRA_FIX_VERSION=v1.0.0-rc.2 JIRA_PROJECT_ID=1 -- "Ready for QA" "[PERA-1]"

if [ "$failures" -gt 0 ]; then
    echo "jira-sync: ${failures} failure(s)"
    exit 1
fi
echo "jira-sync: all checks passed"
