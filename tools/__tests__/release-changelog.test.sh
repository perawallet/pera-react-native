#!/usr/bin/env bash
set -uo pipefail

# Pins the two knobs that let one generator serve both consumers: the Slack
# card wants link syntax and a short list, the uploaded changelog artifact
# wants plain text and every entry. Builds a throwaway repo rather than
# leaning on this repo's real history, which moves.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/release-changelog.sh"
REPO=$(mktemp -d)
trap 'rm -rf "$REPO"' EXIT

failures=0
check() { # $1 label  $2 expected  $3 actual
    if [ "$2" = "$3" ]; then
        echo "  ok    $1"
    else
        echo "  FAIL  $1: expected '$2', got '$3'"
        failures=$((failures + 1))
    fi
}

cd "$REPO" || exit 1
git init -q .
git config user.email t@t.t
git config user.name t
git config commit.gpgsign false

git commit -q --allow-empty -m "base"
BASE=$(git rev-parse HEAD)

# Nine so the default cap of 7 leaves a remainder to report.
for i in $(seq 101 109); do
    git commit -q --allow-empty -m "feat(accounts): change number ${i} [PERA-${i}]"
done

check "slack format links jira refs" "1" \
    "$(LINK_FORMAT=slack "$SCRIPT" "$BASE" | grep -c '<https://algorandfoundation.atlassian.net/browse/PERA-109|PERA-109>')"

check "slack format is the default" "1" \
    "$("$SCRIPT" "$BASE" | grep -c '<https://algorandfoundation.atlassian.net/browse/PERA-109|PERA-109>')"

check "plain format leaves bare ticket ids" "0" \
    "$(LINK_FORMAT=plain "$SCRIPT" "$BASE" | grep -c '<https://')"

check "plain format still lists the entries" "7" \
    "$(LINK_FORMAT=plain "$SCRIPT" "$BASE" | grep -c '^- accounts:')"

check "plain format strips slack bold from section titles" "Features:" \
    "$(LINK_FORMAT=plain "$SCRIPT" "$BASE" | head -1)"

check "slack format keeps bold section titles" '*Features:*' \
    "$("$SCRIPT" "$BASE" | head -1)"

check "default cap emits seven plus a remainder line" "1" \
    "$("$SCRIPT" "$BASE" | grep -c '^- \.\.\.and 2 more')"

check "default cap emits exactly seven entries" "7" \
    "$("$SCRIPT" "$BASE" | grep -c '^- accounts:')"

# The cap used to be a hardcoded `head -n 7` that ignored MAX_COUNT, so a
# caller asking for a different size silently got seven.
check "an explicit cap is honoured, not the hardcoded seven" "3" \
    "$("$SCRIPT" "$BASE" 3 | grep -c '^- accounts:')"

check "uncapped emits every entry" "9" \
    "$(MAX_COUNT=0 "$SCRIPT" "$BASE" | grep -c '^- accounts:')"

check "uncapped emits no remainder line" "0" \
    "$(MAX_COUNT=0 "$SCRIPT" "$BASE" | grep -c 'and .* more')"

if [ "$failures" -gt 0 ]; then
    echo "release-changelog: ${failures} failure(s)"
    exit 1
fi
echo "release-changelog: all checks passed"
