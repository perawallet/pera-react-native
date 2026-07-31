#!/usr/bin/env bash
set -uo pipefail

# tools/release-tickets.sh <tag>
#
# Prints the PERA keys a release delivered — every ticket named in a commit
# subject within this tag's range, one per line.
#
# This list is what makes a commit mandatory for every automated ticket move.
# Plenty of tickets legitimately ship no code — QA verification tasks,
# backend-coupled work, investigations — and those must be moved by a person,
# never by a build that happens to find them in a column.
#
# The range is the previous tag on the SAME channel, because alpha and rc
# interleave on main. A store release is the exception: it delivers everything
# since the previous STORE release, so with no previous stable the range is the
# whole history, which is genuinely what the first one ships.
#
# Subject line only. A squash commit body can cite tickets the PR merely
# references ("blocked by PERA-x"), and those are not what shipped.

TAG="${1:-}"
if [ -z "$TAG" ]; then
    echo "release-tickets: no tag given" >&2
    exit 2
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

IS_STABLE=""
case "$TAG" in
    *-alpha.* | *-rc.*) ;;
    v[0-9]*) IS_STABLE=yes ;;
esac

RANGE_START=$("${ROOT_DIR}/tools/previous-release-tag.sh" "$TAG")

# A prerelease with no predecessor on its channel falls back to the nearest tag
# of any shape rather than to the whole history. A store release does not — see
# above.
if [ -z "$RANGE_START" ] && [ -z "$IS_STABLE" ]; then
    RANGE_START=$(git describe --tags --abbrev=0 "${TAG}^" 2>/dev/null || echo "")
fi

if [ -n "$RANGE_START" ]; then
    RANGE="${RANGE_START}..${TAG}"
elif [ -n "$IS_STABLE" ]; then
    RANGE="$TAG"
else
    # A prerelease with no predecessor at all: nothing to compare against, and
    # sweeping the whole history off a nightly would be wrong.
    exit 0
fi

echo "release-tickets: range ${RANGE}" >&2
git log "$RANGE" --pretty='%s' 2>/dev/null |
    grep -oE '[Pp][Ee][Rr][Aa]-[0-9]+' |
    tr '[:lower:]' '[:upper:]' |
    sort -u
