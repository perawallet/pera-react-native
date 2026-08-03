#!/usr/bin/env bash
set -uo pipefail

# tools/release-range-start.sh [tag]
#
# Prints the tag a release should be diffed against, or nothing when there is no
# sensible predecessor. Defaults to the tag on HEAD.
#
# This is tools/previous-release-tag.sh plus the one fallback its callers share.
# That script deliberately stays pure — it answers "the previous tag on this
# channel" and nothing else — because its third caller
# (tools/publish-github-release.sh) wants no fallback at all: with no predecessor
# it lets GitHub choose the notes range.
#
# The rule, identical for the delivered-ticket list and the Slack changelog:
#
#   - previous tag on the SAME channel, since alpha and rc interleave on main
#   - a PRERELEASE with no predecessor on its channel falls back to the nearest
#     tag of any shape, so the first nightly after a stable cut still diffs
#     against that stable rather than against nothing
#   - a STORE release does not fall back: it delivers everything since the
#     previous store release, so with no previous stable the range is the whole
#     history, which is genuinely what the first one ships. Falling back to
#     "since last night" would make a store release look like a nightly
#
# Callers must distinguish "no predecessor" (empty output) from a real tag; what
# to do with empty differs per caller, which is why this prints nothing rather
# than inventing a range.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TAG="${1:-}"
if [ -z "$TAG" ]; then
    TAG=$(git describe --tags --exact-match HEAD 2>/dev/null || echo "")
fi

IS_STABLE=""
case "$TAG" in
    *-alpha.* | *-rc.*) ;;
    v[0-9]*) IS_STABLE=yes ;;
esac

START=$("${ROOT_DIR}/tools/previous-release-tag.sh" "$TAG")

if [ -z "$START" ] && [ -z "$IS_STABLE" ]; then
    # `${TAG:-HEAD}^`: on a build with no tag at all this still yields the
    # nearest earlier tag, which is what a branch build's changelog wants.
    START=$(git describe --tags --abbrev=0 "${TAG:-HEAD}^" 2>/dev/null || echo "")
fi

printf '%s\n' "$START"
