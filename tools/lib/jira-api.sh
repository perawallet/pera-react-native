# shellcheck shell=bash
#
# tools/lib/jira-api.sh — sourced, never executed.
#
# Shared Jira plumbing for tools/jira-sync.sh (writes) and tools/jira-drift.sh
# (reads). Callers must export JIRA_BASE_URL, JIRA_USER_EMAIL and JIRA_API_TOKEN,
# then call jira_api_init.
#
# Nothing that sources this may use `set -x` — the trace would print the token.

# Returns non-zero when a credential is missing, so the caller decides whether
# that is a warning or a failure.
jira_api_init() {
    local required
    for required in JIRA_BASE_URL JIRA_USER_EMAIL JIRA_API_TOKEN; do
        if [ -z "${!required:-}" ]; then
            # Read by the sourcing script to name the missing variable; shellcheck
            # only sees this file, so it cannot tell the assignment is consumed.
            # shellcheck disable=SC2034
            JIRA_MISSING_CREDENTIAL="$required"
            return 1
        fi
    done
    JIRA_API="${JIRA_BASE_URL%/}/rest/api/3"
}

# Prints the response body followed by a final line holding the HTTP status.
# The status cannot travel in a global: every call site runs this in a $( )
# subshell, where an assignment would be lost.
api() { # $1 method  $2 path  $3 json body (optional)
    local method="$1" path="$2" body="${3:-}"
    local -a args=(
        -sS -w '\n%{http_code}' --max-time 30
        -u "${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}" -X "$method"
    )
    # Reads retry, writes do not. curl retries timeouts and 5xx, but a mutating
    # request that timed out may already have been applied server-side: retrying
    # POST /version can leave a duplicate, and re-POSTing a transition attempts
    # it from the new status, which fails and is reported as if the first attempt
    # had failed. A read is safe to repeat, so only reads get --retry.
    if [ "$method" = "GET" ]; then
        args+=(--retry 2)
    fi
    if [ -n "$body" ]; then
        args+=(-H 'Content-Type: application/json' --data "$body")
    fi
    curl "${args[@]}" "${JIRA_API}${path}" 2>&1
}

code_of() { printf '%s' "${1##*$'\n'}"; }
body_of() { printf '%s' "${1%$'\n'*}"; }

# Emits one compact JSON object per matching issue. Pages to the end rather than
# capping: the deployment column alone holds well over a hundred issues, and a
# silent truncation would read as "nothing to report".
jql_issues() { # $1 jql  $2 comma-separated fields (default: key)
    local jql="$1" fields="${2:-key}" token="" resp code page
    while :; do
        # One array holding every argument, so it is never empty — `set -u` on
        # bash 3.2 rejects "${arr[@]}" when the array has no elements.
        local -a args=(
            -sS -w '\n%{http_code}' --max-time 30 --retry 2
            -u "${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}"
            -G --data-urlencode "jql=${jql}" --data-urlencode "fields=${fields}"
            --data-urlencode 'maxResults=100'
        )
        [ -n "$token" ] && args+=(--data-urlencode "nextPageToken=${token}")
        resp=$(curl "${args[@]}" "${JIRA_API}/search/jql" 2>&1)
        code=$(code_of "$resp")
        page=$(body_of "$resp")
        if [ "$code" != "200" ]; then
            echo "::warning::JQL lookup failed (HTTP ${code})" >&2
            return 1
        fi
        jq -c '.issues[]?' <<<"$page" 2>/dev/null
        token=$(jq -r '.nextPageToken // empty' <<<"$page" 2>/dev/null)
        [ -n "$token" ] || break
    done
}

jql_keys() { # $1 jql
    jql_issues "$1" key | jq -r '.key // empty'
}
