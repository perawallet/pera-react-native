#!/usr/bin/env bash
set -uo pipefail

# This list is the sole gate that makes a commit mandatory for an automated
# ticket move, so its ranges have to be right. Built against a throwaway repo
# with interleaved alpha/rc/stable tags.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/release-tickets.sh"
REPO=$(mktemp -d)
trap 'rm -rf "$REPO"' EXIT

failures=0
check() { # $1 label  $2 expected keys (space separated)  $3 tag
    local got
    got=$("$SCRIPT" "$3" 2>/dev/null | tr '\n' ' ')
    got="${got% }"
    if [ "$got" = "$2" ]; then
        echo "  ok    $1"
    else
        echo "  FAIL  $1: expected '$2', got '$got'"
        failures=$((failures + 1))
    fi
}

cd "$REPO" || exit 1
git init -q .
git config user.email t@t.t
git config user.name t
git config commit.gpgsign false

tag_after() { # $1 subject  $2 tag
    git commit -q --allow-empty -m "$1"
    git tag -a "$2" -m "$2"
}

tag_after "fix(a): one [PERA-1]" v1.0.0-alpha.1
tag_after "fix(b): two [PERA-2]" v1.0.0-alpha.2
# An rc cut mid-stream: it delivers everything since the previous rc, not since
# last night's alpha.
tag_after "fix(c): three [PERA-3]" v1.0.0-rc.1
tag_after "fix(d): four [PERA-4]" v1.0.0-alpha.3
tag_after "fix(e): five [PERA-5]" v1.0.0-rc.2

# Everything since the previous NIGHTLY, which includes the commit the mid-stream
# rc was cut from. That commit shipped in the rc too; both channels delivering it
# is correct, and the sync is idempotent.
check "a nightly delivers everything since the previous nightly" \
    "PERA-3 PERA-4" v1.0.0-alpha.3
check "an rc delivers everything since the previous rc, across the alphas" \
    "PERA-4 PERA-5" v1.0.0-rc.2
check "the first rc falls back to the nearest tag of any shape" "PERA-3" v1.0.0-rc.1

# A store release with no predecessor delivers the whole history — that is what
# the first one ships, and "since last night" would be wrong.
git commit -q --allow-empty -m "fix(f): six [PERA-6]"
git tag -a v1.0.0 -m v1.0.0
check "the first store release delivers everything" \
    "PERA-1 PERA-2 PERA-3 PERA-4 PERA-5 PERA-6" v1.0.0

# The next one delivers only since the previous stable, never since a prerelease.
tag_after "fix(g): seven [PERA-7]" v1.0.0-alpha.4
tag_after "fix(h): eight [PERA-8]" v1.0.1
check "a later store release delivers only since the previous store release" \
    "PERA-7 PERA-8" v1.0.1

# Commits with no key contribute nothing, which is the whole point: a ticket
# needing no branch or PR never appears here.
git commit -q --allow-empty -m "chore: no ticket at all"
git tag -a v1.0.2 -m v1.0.2
check "a release carrying no ticketed commits yields nothing" "" v1.0.2

git commit -q --allow-empty -m "fix(i): lowercase key [pera-9]"
git tag -a v1.0.3 -m v1.0.3
check "a lowercase key is normalised" "PERA-9" v1.0.3

if [ "$failures" -gt 0 ]; then
    echo "release-tickets: ${failures} failure(s)"
    exit 1
fi
echo "release-tickets: all checks passed"
