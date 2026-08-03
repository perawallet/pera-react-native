#!/usr/bin/env bash
set -uo pipefail

# tools/previous-release-tag.sh [tag]
#
# Prints the release tag preceding <tag> on the SAME channel, or nothing when
# there is no predecessor. Defaults to the tag on HEAD.
#
# alpha and rc interleave on main, so an unrestricted `git describe` returns
# whichever channel tagged most recently and yields a range that is too short: a
# Friday rc would diff against Thursday's nightly, and that night's nightly would
# then diff against the rc and skip Friday morning entirely. Mirrors the
# per-channel counter in tools/create-nightly-tag.sh.
#
# Deliberately prints nothing rather than guessing when a channel has no earlier
# tag — each caller picks its own fallback, because the right answer differs
# (the changelog wants the nearest tag of any shape; GitHub release notes are
# better off letting GitHub choose).

TAG="${1:-}"
if [ -z "$TAG" ]; then
    TAG=$(git describe --tags --exact-match HEAD 2>/dev/null || echo "")
fi
if [ -z "$TAG" ]; then
    exit 0
fi

# Deliberately not `git describe`: when its --match/--exclude filters leave no
# candidate it falls back to a long form (v7.0.0-alpha.34-36-g<sha>), which reads
# like a tag and would silently become a bogus range. Listing tags reachable from
# the parent and filtering on exact shape can only ever return a real tag, or
# nothing. --merged keeps it to ancestors.
#
# Sorted by version, not by date. Dates tie whenever two tags are minted in the
# same second, and a tied -creatordate sorts ascending — which silently returns
# the OLDEST tag on the channel instead of the newest. Version order is total
# here (refnames are unique) and counts numerically, so alpha.10 beats alpha.9.
previous() { # $1 tag glob  $2 exact-shape regex
    git tag --list "$1" --merged "${TAG}^" --sort=-v:refname 2>/dev/null |
        grep -E "$2" | head -1
}

case "$TAG" in
    *-alpha.*) previous 'v*-alpha.*' '^v[0-9]+\.[0-9]+\.[0-9]+-alpha\.[0-9]+$' ;;
    *-rc.*) previous 'v*-rc.*' '^v[0-9]+\.[0-9]+\.[0-9]+-rc\.[0-9]+$' ;;
    # Stable: the previous stable only, never a prerelease of the same version.
    v*) previous 'v*' '^v[0-9]+\.[0-9]+\.[0-9]+$' ;;
esac
