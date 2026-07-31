#!/usr/bin/env bash
set -uo pipefail

# Pins the per-channel range rule: alpha and rc interleave on main, so each
# channel must diff against its own predecessor. Builds a throwaway repo with
# interleaved tags rather than leaning on this repo's real tags, which move.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/previous-release-tag.sh"
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

# alpha.1 .. alpha.3, then rc.1 mid-stream, then alpha.4 and rc.2 — the shape
# that made an unrestricted `git describe` pick the wrong baseline.
for tag in v1.0.0-alpha.1 v1.0.0-alpha.2 v1.0.0-alpha.3 v1.0.0-rc.1 v1.0.0-alpha.4 v1.0.0-rc.2; do
    git commit -q --allow-empty -m "work before ${tag}"
    git tag -a "$tag" -m "$tag"
done

check "alpha follows the previous alpha, not the rc between them" \
    v1.0.0-alpha.3 "$("$SCRIPT" v1.0.0-alpha.4)"
check "rc follows the previous rc, not the alpha between them" \
    v1.0.0-rc.1 "$("$SCRIPT" v1.0.0-rc.2)"
check "first rc on the channel has no predecessor" \
    "" "$("$SCRIPT" v1.0.0-rc.1)"
check "first alpha on the channel has no predecessor" \
    "" "$("$SCRIPT" v1.0.0-alpha.1)"

git commit -q --allow-empty -m "1.0.0"
git tag -a v1.0.0 -m v1.0.0
check "first stable has no previous stable" "" "$("$SCRIPT" v1.0.0)"

git commit -q --allow-empty -m "1.0.1"
git tag -a v1.0.1 -m v1.0.1
check "stable follows the previous stable, never a prerelease" \
    v1.0.0 "$("$SCRIPT" v1.0.1)"

# A tag that merely starts with v must not be mistaken for a stable release,
# and must never surface as a range boundary.
git tag -a vjunk -m vjunk
git commit -q --allow-empty -m "1.0.2"
git tag -a v1.0.2 -m v1.0.2
check "a non-release tag is ignored when picking the previous stable" \
    v1.0.1 "$("$SCRIPT" v1.0.2)"

check "an unknown tag yields nothing" "" "$("$SCRIPT" not-a-tag)"

if [ "$failures" -gt 0 ]; then
    echo "previous-release-tag: ${failures} failure(s)"
    exit 1
fi
echo "previous-release-tag: all checks passed"
