#!/usr/bin/env bash
set -uo pipefail

# tools/jira-drift.sh
#
# Reports tickets whose Jira state disagrees with what git and the release
# pipeline say happened. Every stage of the sync exits 0 by design — ticket
# bookkeeping must never break a build — which means a rotated token, a missing
# Bitrise secret or a skipped step produces no signal at all. This is that
# signal.
#
# Read-only: it never transitions, assigns or stamps anything.
#
# Two checks, both chosen for low noise. A report that cries wolf gets ignored,
# which would defeat the point:
#
#   1. Merged but not advanced — the key is in a commit on main older than the
#      grace window, yet the ticket is still pre-build. Catches the merge or
#      nightly stage silently not firing.
#   2. Shipped but unstamped — the ticket is at or past Waiting for Deployment
#      with no fix version. By then it has been through an rc, so a missing
#      version means the stamping step failed.
#
# Env:
#   JIRA_BASE_URL, JIRA_USER_EMAIL, JIRA_API_TOKEN  required
#   JIRA_SCOPE_JQL                                  defaults to the board filter
#                                                   in tools/lib/jira-api.sh
#   DRIFT_GRACE_HOURS                               default 48
#   DRIFT_LOOKBACK_DAYS                             default 30

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=tools/lib/jira-api.sh
. "${ROOT_DIR}/tools/lib/jira-api.sh"

if ! jira_api_init; then
    echo "::warning::jira-drift: ${JIRA_MISSING_CREDENTIAL} is not set — cannot report drift"
    exit 0
fi
JIRA_SCOPE_JQL="${JIRA_SCOPE_JQL-$JIRA_DEFAULT_SCOPE_JQL}"
if [ -z "$JIRA_SCOPE_JQL" ]; then
    echo "::warning::jira-drift: JIRA_SCOPE_JQL is empty — refusing to report on the whole project"
    exit 0
fi

GRACE_HOURS="${DRIFT_GRACE_HOURS:-48}"
LOOKBACK_DAYS="${DRIFT_LOOKBACK_DAYS:-30}"
PRE_BUILD_STATUSES='"To Do", "Ready for Dev", "In Progress", "In Code Review"'
SHIPPED_STATUSES='"Waiting for Deployment", "Done"'

# Newest commit timestamp per ticket key, from one pass over main. Per-key `git
# log --grep` would be correct too but costs a process per ticket, and the newest
# commit is what decides whether the grace window has elapsed — a follow-up fix
# landing today should not be reported as stale.
newest_commit_epoch=$(mktemp)
trap 'rm -f "$newest_commit_epoch"' EXIT
main_ref=origin/main
git rev-parse -q --verify "$main_ref" >/dev/null 2>&1 || main_ref=HEAD
git log "$main_ref" --since="${LOOKBACK_DAYS} days ago" --pretty='%ct %s' 2>/dev/null |
    while read -r epoch subject; do
        printf '%s\n' "$subject" | grep -oE 'PERA-[0-9]+' | while read -r key; do
            printf '%s %s\n' "$key" "$epoch"
        done
    done | sort -k1,1 -k2,2nr | sort -u -k1,1 >"$newest_commit_epoch"

merged_keys=$(cut -d' ' -f1 "$newest_commit_epoch" | sort -u)
if [ -z "$merged_keys" ]; then
    echo "jira-drift: no ticketed commits on main in the last ${LOOKBACK_DAYS} days"
    exit 0
fi

now=$(date -u +%s)
cutoff=$((now - GRACE_HOURS * 3600))

report=""
drift=0

add_row() { # $1 key  $2 status  $3 note
    report="${report}| [${1}](${JIRA_BASE_URL%/}/browse/${1}) | ${2} | ${3} |"$'\n'
    drift=$((drift + 1))
}

# --- 1. merged but not advanced -------------------------------------------------
if ! stalled=$(jql_issues "(${JIRA_SCOPE_JQL}) AND status in (${PRE_BUILD_STATUSES})" 'key,status'); then
    echo "::warning::jira-drift: could not read pre-build issues — report is incomplete"
fi
while IFS= read -r issue; do
    [ -n "$issue" ] || continue
    key=$(jq -r '.key' <<<"$issue")
    status=$(jq -r '.fields.status.name' <<<"$issue")
    epoch=$(awk -v k="$key" '$1 == k { print $2 }' "$newest_commit_epoch")
    [ -n "$epoch" ] || continue
    if [ "$epoch" -lt "$cutoff" ]; then
        age_h=$(((now - epoch) / 3600))
        add_row "$key" "$status" "on main ${age_h}h ago, never advanced"
    fi
done <<<"$stalled"

# --- 2. shipped but unstamped --------------------------------------------------
if ! unstamped=$(jql_issues "(${JIRA_SCOPE_JQL}) AND status in (${SHIPPED_STATUSES}) AND fixVersion IS EMPTY" 'key,status'); then
    echo "::warning::jira-drift: could not read shipped issues — report is incomplete"
fi
while IFS= read -r issue; do
    [ -n "$issue" ] || continue
    key=$(jq -r '.key' <<<"$issue")
    status=$(jq -r '.fields.status.name' <<<"$issue")
    # Only tickets this repo actually shipped; a ticket closed without code is
    # legitimately unstamped and is not this report's business.
    grep -qxF "$key" <<<"$merged_keys" || continue
    add_row "$key" "$status" "shipped with no fix version"
done <<<"$unstamped"

# --- output -------------------------------------------------------------------
{
    if [ "$drift" -eq 0 ]; then
        echo "## Jira drift: none"
        echo
        echo "Checked ${GRACE_HOURS}h grace over $(printf '%s' "$merged_keys" | grep -c .) ticket(s) on main in the last ${LOOKBACK_DAYS} days."
    else
        echo "## Jira drift: ${drift} ticket(s) need attention"
        echo
        echo "| Ticket | Status | Why |"
        echo "| --- | --- | --- |"
        printf '%s' "$report"
        echo
        echo "A ticket appears here when git and Jira disagree — usually a sync step that failed silently."
    fi
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "drift=${drift}" >>"$GITHUB_OUTPUT"
fi
exit 0
