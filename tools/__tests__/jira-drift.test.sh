#!/usr/bin/env bash
set -uo pipefail

# The drift report is the only thing that notices when a sync stage fails
# silently, so its own logic needs to be right. Runs against a throwaway repo
# with backdated commits and a stubbed Jira.

DRIFT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/jira-drift.sh"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/bin"
cat >"$WORK/bin/curl" <<'STUB'
#!/usr/bin/env bash
jql=""
while [ $# -gt 0 ]; do
    case "$1" in
        --data-urlencode) case "$2" in jql=*) jql="${2#jql=}" ;; esac; shift 2 ;;
        *) shift ;;
    esac
done
case "$jql" in
    *"fixVersion IS EMPTY"*) printf '%s\n200' "${STUB_UNSTAMPED:-{\"issues\":[]\}}" ;;
    *) printf '%s\n200' "${STUB_PREBUILD:-{\"issues\":[]\}}" ;;
esac
STUB
chmod +x "$WORK/bin/curl"

export PATH="$WORK/bin:$PATH"
export JIRA_BASE_URL=https://example.atlassian.net
export JIRA_USER_EMAIL=ci@example.com
export JIRA_API_TOKEN=token
export JIRA_SCOPE_JQL='project = PERA'

REPO="$WORK/repo"
mkdir -p "$REPO"
cd "$REPO" || exit 1
git init -q .
git config user.email t@t.t
git config user.name t
git config commit.gpgsign false

commit_at() { # $1 days ago  $2 subject
    local when
    when=$(git log -1 --format=%ct 2>/dev/null || true)
    GIT_AUTHOR_DATE="$(($(date -u +%s) - $1 * 86400))" \
        GIT_COMMITTER_DATE="$(($(date -u +%s) - $1 * 86400))" \
        git commit -q --allow-empty -m "$2"
    : "${when:-}"
}

commit_at 5 "fix(a): stale thing [PERA-100]"
commit_at 0 "fix(b): landed just now [PERA-200]"

failures=0
check() { # $1 label  $2 must-contain  $3 must-NOT-contain ('' skips)
    local label="$1" want="$2" avoid="$3" out
    shift 3
    out=$(env "$@" bash "$DRIFT" 2>&1)
    if ! grep -qF -- "$want" <<<"$out"; then
        echo "  FAIL  ${label}: expected '${want}'"
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

PRE='{"issues":[{"key":"PERA-100","fields":{"status":{"name":"In Code Review"}}},{"key":"PERA-200","fields":{"status":{"name":"In Code Review"}}}]}'

check "a ticket merged past the grace window is reported" \
    "PERA-100" "" STUB_PREBUILD="$PRE"

check "a ticket merged just now is inside the grace window" \
    "PERA-100" "PERA-200" STUB_PREBUILD="$PRE"

check "a wide grace window reports nothing" \
    "Jira drift: none" "PERA-100" STUB_PREBUILD="$PRE" DRIFT_GRACE_HOURS=720

check "a pre-build ticket with no commit on main is not drift" \
    "Jira drift: none" "PERA-999" \
    STUB_PREBUILD='{"issues":[{"key":"PERA-999","fields":{"status":{"name":"In Progress"}}}]}'

check "a shipped ticket with no fix version is reported" \
    "shipped with no fix version" "" \
    STUB_UNSTAMPED='{"issues":[{"key":"PERA-100","fields":{"status":{"name":"Done"}}}]}'

check "an unstamped ticket this repo never shipped is ignored" \
    "Jira drift: none" "PERA-777" \
    STUB_UNSTAMPED='{"issues":[{"key":"PERA-777","fields":{"status":{"name":"Done"}}}]}'

check "the board filter is mandatory" \
    "refusing to report on the whole project" "" JIRA_SCOPE_JQL=

check "a missing credential degrades instead of failing" \
    "JIRA_API_TOKEN is not set" "" JIRA_API_TOKEN=

if [ "$failures" -gt 0 ]; then
    echo "jira-drift: ${failures} failure(s)"
    exit 1
fi
echo "jira-drift: all checks passed"
