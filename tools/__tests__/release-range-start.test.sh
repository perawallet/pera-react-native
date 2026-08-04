#!/usr/bin/env bash
set -uo pipefail

# Pins the fallback rule that tools/release-range-start.sh adds on top of
# tools/previous-release-tag.sh, and that the delivered-ticket list and the Slack
# changelog both depend on:
#
#   - a prerelease with no predecessor on its channel falls back to the nearest
#     tag of any shape
#   - a store release never falls back, so it cannot end up diffing against last
#     night's nightly
#
# Throwaway repo rather than this repo's real tags, which move.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/release-range-start.sh"
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

git commit -q --allow-empty -m "1.0.0"
git tag -a v1.0.0 -m v1.0.0

# The case the fallback exists for: opening a new version's alpha channel. There
# is no earlier alpha, and diffing against nothing would make the first nightly
# of a cycle list the entire history.
git commit -q --allow-empty -m "first work after the cut"
git tag -a v1.1.0-alpha.1 -m v1.1.0-alpha.1
check "first alpha on a channel falls back to the last tag of any shape" \
    v1.0.0 "$("$SCRIPT" v1.1.0-alpha.1)"

git commit -q --allow-empty -m "more work"
git tag -a v1.1.0-alpha.2 -m v1.1.0-alpha.2
check "a later alpha still follows its own channel" \
    v1.1.0-alpha.1 "$("$SCRIPT" v1.1.0-alpha.2)"

# Same fallback for a channel's first rc, which opens mid-cycle.
git commit -q --allow-empty -m "rc work"
git tag -a v1.1.0-rc.1 -m v1.1.0-rc.1
check "first rc on a channel falls back to the last tag of any shape" \
    v1.1.0-alpha.2 "$("$SCRIPT" v1.1.0-rc.1)"

# The asymmetry that matters: a store release must NOT inherit the prerelease
# fallback, or v1.1.0 would report only what changed since its own last rc
# instead of everything since v1.0.0.
git commit -q --allow-empty -m "1.1.0"
git tag -a v1.1.0 -m v1.1.0
check "store release follows the previous stable, not the rc before it" \
    v1.0.0 "$("$SCRIPT" v1.1.0)"

check "no argument resolves the tag on HEAD" \
    v1.0.0 "$("$SCRIPT")"

# The first store release of all: no previous stable and, unlike a prerelease,
# no fallback — an empty range start means "the whole history", which is what it
# genuinely ships.
check "first store release has no predecessor and does not fall back" \
    "" "$("$SCRIPT" v1.0.0)"

if [ "$failures" -gt 0 ]; then
    echo "release-range-start: ${failures} failure(s)"
    exit 1
fi
echo "release-range-start: all checks passed"
