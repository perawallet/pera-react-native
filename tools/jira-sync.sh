#!/usr/bin/env bash
set -uo pipefail

# tools/jira-sync.sh <target-status> [PERA-1 PERA-2 ...]
#
# Moves Jira issues to a target status, optionally reassigning them and stamping
# a fix version. Shared by .github/workflows/jira-sync.yml (branch pushed / PR
# opened / merged to main) and .bitrise/bitrise.yml `notify-release` (nightly +
# RC builds), so the rules for talking to Jira live in exactly one place.
#
# Arguments are scanned for PERA-<digits> tokens, so whole commit subjects,
# branch names or PR titles can be passed verbatim; anything else is ignored.
#
# Env:
#   JIRA_BASE_URL, JIRA_USER_EMAIL, JIRA_API_TOKEN  required
#   JIRA_ASSIGNEE_ACCOUNT_ID                        optional — also set assignee
#   JIRA_FIX_VERSION                                optional — create it if
#                                                   absent, then stamp issues
#                                                   that have none yet
#   JIRA_PROJECT_ID                                 required with the above
#   JIRA_SCOPE_JQL                                  optional — confirm every
#                                                   candidate against this board
#                                                   filter first, skipping any
#                                                   issue outside it
#   JIRA_SKIP_STATUSES                              optional — comma-separated
#                                                   statuses to leave untouched
#   JIRA_ONLY_FROM_STATUSES                         optional — comma-separated
#                                                   statuses to act on, skipping
#                                                   every other
#   JIRA_THROTTLE_SECONDS                           optional — pause between
#                                                   issues (default 0.1)
#   DRY_RUN                                         when "1": read and report,
#                                                   but withhold every write
#
# Deliberately exits 0 even when individual issues fail: ticket bookkeeping must
# never break a push, a merge, or a release build. Problems surface as GitHub
# Actions warning annotations (which are plain text everywhere else).
#
# No `set -x` anywhere below — the trace would print the API token.

TARGET_STATUS="${1:-}"
if [ -z "$TARGET_STATUS" ]; then
    echo "jira-sync: missing target status argument" >&2
    exit 2
fi
shift

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=tools/lib/jira-api.sh
. "${ROOT_DIR}/tools/lib/jira-api.sh"

if ! jira_api_init; then
    echo "::warning::jira-sync: ${JIRA_MISSING_CREDENTIAL} is not set — skipping Jira sync"
    exit 0
fi

if [ "$#" -eq 0 ]; then
    echo "jira-sync: no issues given — nothing to do"
    exit 0
fi

degraded=0

# The pipeline, in order. Automation only ever moves a ticket UP this list: a
# build advances work, it never undoes a decision someone made by hand. Anything
# not on the list — Blocked, the *Input Needed states, Cancelled, Duplicate — is
# a deliberate park rather than a position in the flow, and is left alone.
#
# This single rule replaces the per-stage allow/skip lists it would otherwise
# take to say the same thing, and it cannot drift out of step with itself.
JIRA_STATUS_ORDER="${JIRA_STATUS_ORDER:-To Do,Ready for Dev,In Progress,In Code Review,Ready for QA,In QA,Waiting for Deployment,In Beta,Done}"

status_rank() { # $1 status -> position on stdout; non-zero when off-pipeline
    local target="$1" position=0 status
    local IFS=,
    for status in $JIRA_STATUS_ORDER; do
        if [ "$status" = "$target" ]; then
            printf '%s' "$position"
            return 0
        fi
        position=$((position + 1))
    done
    return 1
}

# Every mutating call goes through here so DRY_RUN can withhold it. Reads still
# happen under DRY_RUN, so the report reflects the real state of each issue.
write() { # $1 method  $2 path  $3 json body  $4 status to report when skipped
    if [ "${DRY_RUN:-}" = "1" ]; then
        echo "  would ${1} ${2} ${3}" >&2
        printf '%s' "$4"
        return 0
    fi
    code_of "$(api "$1" "$2" "$3")"
}

# Candidates only ever come from text the caller passed in — a branch name, a PR
# title, a commit subject. Deliberately no status-based lookup: a ticket with no
# branch, PR or commit must be moved by a person, and selecting on status alone
# would sweep exactly those up.
input=$(printf '%s\n' "$@")

KEYS=$(printf '%s\n' "$input" | grep -oE '[Pp][Ee][Rr][Aa]-[0-9]+' | tr '[:lower:]' '[:upper:]' | sort -u)
if [ -z "$KEYS" ]; then
    echo "jira-sync: no PERA keys resolved — nothing to do"
    exit 0
fi

# Keeps the automation inside one board. Keys parsed out of branch names, PR
# titles and commit subjects are just text — a PR that happens to cite a Backend
# ticket must not move it — so every candidate is confirmed against the board's
# own filter before anything is written. Batched because `key in (...)` grows
# with the release size and this runs over a hundred keys on a store build.
scoped_keys() { # $1 scope jql, rest: candidate keys
    local scope="$1" batch="" count=0 key
    shift
    for key in "$@"; do
        batch="${batch}${batch:+,}${key}"
        count=$((count + 1))
        if [ "$count" -ge 50 ]; then
            jql_keys "key in (${batch}) AND (${scope})" || return 1
            batch=""
            count=0
        fi
    done
    if [ -n "$batch" ]; then
        jql_keys "key in (${batch}) AND (${scope})" || return 1
    fi
}

if [ -n "${JIRA_SCOPE_JQL:-}" ]; then
    # Fails closed: when the check itself cannot run, touch nothing.
    if ! in_scope=$(scoped_keys "$JIRA_SCOPE_JQL" $KEYS); then
        echo "::warning::jira-sync: board scope check failed — refusing to touch any issue"
        exit 0
    fi
    in_scope=$(printf '%s\n' "$in_scope" | grep -E '^PERA-[0-9]+$' | sort -u)
    for key in $KEYS; do
        case $'\n'"${in_scope}"$'\n' in
            *$'\n'"${key}"$'\n'*) ;;
            *) echo "${key}: not on the board — left alone" ;;
        esac
    done
    KEYS="$in_scope"
    if [ -z "$KEYS" ]; then
        echo "jira-sync: no candidate issues are on the board — nothing to do"
        exit 0
    fi
fi

# Creating a version needs Administer Projects, which transitioning does not, so
# this degrades to "skip fix versions" rather than failing the release.
find_version() { # $1 version name -> id on stdout, non-zero when the list is unreadable
    local resp
    resp=$(api GET "/project/${JIRA_PROJECT_ID}/versions")
    if [ "$(code_of "$resp")" != "200" ]; then
        return 1
    fi
    body_of "$resp" |
        jq -r --arg name "$1" 'first(.[] | select(.name == $name) | .id) // empty'
}

ensure_fix_version() { # $1 version name
    local name="$1" code
    if ! existing=$(find_version "$name"); then
        echo "::warning::could not list versions of project ${JIRA_PROJECT_ID}"
        return 1
    fi
    if [ -n "$existing" ]; then
        echo "fix version '${name}' already exists"
        return 0
    fi
    code=$(write POST "/version" "$(jq -nc \
        --arg name "$name" --arg project "$JIRA_PROJECT_ID" --arg date "$(date -u +%F)" \
        '{name: $name, projectId: ($project | tonumber), released: true, releaseDate: $date}')" 201)
    if [ "$code" = "201" ]; then
        echo "created fix version '${name}'"
        return 0
    fi
    # Check-then-create is a race: a concurrent build (a rebuild of the same tag,
    # or a re-run) may have created it in between, and Jira answers 400. Losing
    # that race must not disable fix versions for the whole run.
    if existing=$(find_version "$name") && [ -n "$existing" ]; then
        echo "fix version '${name}' was created concurrently — using it"
        return 0
    fi
    echo "::warning::could not create fix version '${name}' (HTTP ${code}) — the Jira account needs Administer Projects"
    return 1
}

FIX_VERSION="${JIRA_FIX_VERSION:-}"
if [ -n "$FIX_VERSION" ]; then
    if [ -z "${JIRA_PROJECT_ID:-}" ]; then
        echo "::warning::JIRA_FIX_VERSION set without JIRA_PROJECT_ID — skipping fix versions"
        FIX_VERSION=""
        degraded=1
    elif ! ensure_fix_version "$FIX_VERSION"; then
        FIX_VERSION=""
        degraded=1
    fi
fi

first_issue=yes
for key in $KEYS; do
    # Jira Cloud rate-limits per account, and a store build walks well over a
    # hundred issues at three calls each. Pacing the loop keeps the burst under
    # the limit rather than leaning on 429 retries, which ignore Retry-After.
    if [ -z "$first_issue" ]; then
        sleep "${JIRA_THROTTLE_SECONDS:-0.1}"
    fi
    first_issue=

    resp=$(api GET "/issue/${key}?fields=status,fixVersions")
    issue_code=$(code_of "$resp")
    issue=$(body_of "$resp")
    current=$(jq -r '.fields.status.name // empty' <<<"$issue" 2>/dev/null)
    if [ "$issue_code" != "200" ] || [ -z "$current" ]; then
        echo "::warning::${key}: could not read issue (HTTP ${issue_code}) — skipped"
        degraded=1
        continue
    fi

    # Guards against dragging work backwards: a release sweep must not reopen a
    # ticket QA has already closed out.
    if [ -n "${JIRA_SKIP_STATUSES:-}" ]; then
        case ",${JIRA_SKIP_STATUSES}," in
            *",${current},"*)
                echo "${key}: in '${current}' — left alone"
                continue
                ;;
        esac
    fi

    # Forward-only. Blocks the whole class of regressions where a later commit
    # citing an already-tested key drags the ticket back down the pipeline —
    # Waiting for Deployment losing QA's sign-off, In QA losing active testing,
    # Done being reopened by a follow-up branch.
    if ! current_rank=$(status_rank "$current"); then
        echo "${key}: '${current}' is outside the pipeline — left alone"
        continue
    fi
    if ! target_rank=$(status_rank "$TARGET_STATUS"); then
        echo "::warning::${key}: target '${TARGET_STATUS}' is not in the pipeline — skipped"
        degraded=1
        continue
    fi
    if [ "$target_rank" -lt "$current_rank" ]; then
        echo "${key}: '${current}' is already past '${TARGET_STATUS}' — left alone"
        continue
    fi

    # Forward is necessary but not always sufficient: a store build marks Done
    # only what QA parked for deployment, never something still under test.
    if [ -n "${JIRA_ONLY_FROM_STATUSES:-}" ]; then
        case ",${JIRA_ONLY_FROM_STATUSES}," in
            *",${current},"*) ;;
            *)
                echo "${key}: in '${current}', not '${JIRA_ONLY_FROM_STATUSES}' — left alone"
                continue
                ;;
        esac
    fi

    if [ "$current" = "$TARGET_STATUS" ]; then
        echo "${key}: already '${TARGET_STATUS}'"
    else
        # Every PERA transition is global and screenless, so the target is always
        # one hop away; resolving by name keeps this readable if IDs ever change.
        transition_id=$(body_of "$(api GET "/issue/${key}/transitions")" |
            jq -r --arg name "$TARGET_STATUS" \
                'first(.transitions[] | select(.to.name == $name) | .id) // empty' 2>/dev/null)
        if [ -z "$transition_id" ]; then
            echo "::warning::${key}: no transition to '${TARGET_STATUS}' from '${current}' — skipped"
            degraded=1
        else
            code=$(write POST "/issue/${key}/transitions" \
                "$(jq -nc --arg id "$transition_id" '{transition: {id: $id}}')" 204)
            if [ "$code" = "204" ]; then
                echo "${key}: '${current}' → '${TARGET_STATUS}'"
            else
                echo "::warning::${key}: transition to '${TARGET_STATUS}' failed (HTTP ${code})"
                degraded=1
            fi
        fi
    fi

    # Independent of the transition above: on merge the status is usually already
    # correct and the handoff to QA is the only thing that actually changes.
    if [ -n "${JIRA_ASSIGNEE_ACCOUNT_ID:-}" ]; then
        code=$(write PUT "/issue/${key}/assignee" \
            "$(jq -nc --arg id "$JIRA_ASSIGNEE_ACCOUNT_ID" '{accountId: $id}')" 204)
        if [ "$code" = "204" ]; then
            echo "${key}: assignee set"
        else
            echo "::warning::${key}: assignee update failed (HTTP ${code})"
            degraded=1
        fi
    fi

    # The first build that shipped the fix wins, so an existing value is never
    # overwritten and later builds carrying the same ticket leave it alone.
    if [ -n "$FIX_VERSION" ]; then
        if [ "$(jq -r '.fields.fixVersions | length' <<<"$issue" 2>/dev/null)" != "0" ]; then
            echo "${key}: fix version already recorded — left as first-fixed"
        else
            code=$(write PUT "/issue/${key}" \
                "$(jq -nc --arg name "$FIX_VERSION" \
                    '{update: {fixVersions: [{add: {name: $name}}]}}')" 204)
            if [ "$code" = "204" ]; then
                echo "${key}: fix version '${FIX_VERSION}'"
            else
                echo "::warning::${key}: fix version update failed (HTTP ${code})"
                degraded=1
            fi
        fi
    fi
done

if [ "$degraded" = "1" ]; then
    echo "jira-sync: finished with warnings (not failing the build)"
fi
exit 0
