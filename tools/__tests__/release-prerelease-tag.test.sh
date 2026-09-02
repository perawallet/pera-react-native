#!/usr/bin/env bash
set -uo pipefail

# Pins the base version prereleases are cut against. package.json is not bumped
# as part of releasing, so it drifts behind; the base has to come from the newest
# STABLE tag, not from whether package.json's own version happens to be tagged.
# The stable tags are not contiguous either — a deleted or never-cut vX.Y.Z leaves
# a hole, and walking one patch at a time stops in it and cuts prereleases BELOW
# the shipped release. Both shapes are pinned below.
# Builds throwaway repos rather than leaning on this repo's real tags, which move.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/release-prerelease-tag.sh"

failures=0
check() { # $1 label  $2 expected  $3 actual
    if [ "$2" = "$3" ]; then
        echo "  ok    $1"
    else
        echo "  FAIL  $1: expected '$2', got '$3'"
        failures=$((failures + 1))
    fi
}

# A fresh repo whose package.json declares $1, with $2... created as tags.
new_repo() {
    local version="$1"
    shift
    REPO=$(mktemp -d)
    cd "$REPO" || exit 1
    git init -q .
    git config user.email t@t.t
    git config user.name t
    git config commit.gpgsign false
    printf '{"version": "%s"}\n' "$version" >package.json
    git add package.json
    git commit -q -m "initial"
    for tag in "$@"; do
        git commit -q --allow-empty -m "work before ${tag}"
        git tag -a "$tag" -m "$tag"
    done
    git commit -q --allow-empty -m "unreleased work"
}

# The tag the script would cut, or "" when it declines to cut one.
next_tag() { # $1 channel
    DRY_RUN=1 CHANNEL="$1" PKG_JSON="$REPO/package.json" "$SCRIPT" 2>&1 |
        sed -n 's/^Next .* tag: //p'
}

skipped() { # $1 channel
    DRY_RUN=1 CHANNEL="$1" PKG_JSON="$REPO/package.json" "$SCRIPT" 2>&1 |
        grep -qF 'skipping' && echo yes || echo no
}

new_repo 7.0.0
check "no stable tag yet: stays on the package.json version" \
    v7.0.0-alpha.1 "$(next_tag alpha)"

new_repo 7.0.0 v7.0.0
check "one stable behind: rolls to the next patch" \
    v7.0.1-alpha.1 "$(next_tag alpha)"

new_repo 7.1.1 v7.1.1 v7.1.2 v7.1.3
check "three stable behind: targets the patch above the newest" \
    v7.1.4-alpha.1 "$(next_tag alpha)"

# The shape that made the first fix look correct locally while staying broken in
# CI: origin has no bare v7.1.2, so a contiguity walk halts at 7.1.2.
new_repo 7.1.1 v7.1.1 v7.1.2-alpha.8 v7.1.2-rc.4 v7.1.3
check "gap in the stable chain: still targets above the newest shipped" \
    v7.1.4-alpha.1 "$(next_tag alpha)"

new_repo 7.1.1 v7.1.1 v7.1.2-alpha.8 v7.1.2-rc.4 v7.1.3
check "gap in the stable chain, rc channel" \
    v7.1.4-rc.1 "$(next_tag rc)"

# A prerelease of a HIGHER version must not be mistaken for a shipped stable.
new_repo 7.1.1 v7.1.1 v7.1.5-rc.1
check "prereleases above the newest stable do not raise the base" \
    v7.1.2-alpha.1 "$(next_tag alpha)"

new_repo 7.2.0 v7.1.1 v7.1.3
check "package.json ahead of every stable: keeps its own version" \
    v7.2.0-alpha.1 "$(next_tag alpha)"

new_repo 7.1.9 v7.1.9 v7.1.10
check "patch numbers compare numerically, not lexically" \
    v7.1.11-alpha.1 "$(next_tag alpha)"

new_repo 7.1.1 v7.1.1 v7.1.2 v7.1.3
check "rc shares the rolled-forward base" \
    v7.1.4-rc.1 "$(next_tag rc)"

new_repo 7.0.0 v7.0.0-alpha.1 v7.0.0-alpha.2
check "counter continues from the highest existing suffix" \
    v7.0.0-alpha.3 "$(next_tag alpha)"

new_repo 7.1.1 v7.1.2-alpha.8 v7.1.1 v7.1.2 v7.1.3
check "counter restarts when the base rolls past the tagged one" \
    v7.1.4-alpha.1 "$(next_tag alpha)"

new_repo 7.0.0 v7.0.0-alpha.1 v7.0.0-alpha.9 v7.0.0-alpha.10
check "suffix compares numerically, not as a string" \
    v7.0.0-alpha.11 "$(next_tag alpha)"

# The gate gets its own repo: HEAD must sit ON the last tag of the channel.
REPO=$(mktemp -d)
cd "$REPO" || exit 1
git init -q .
git config user.email t@t.t
git config user.name t
git config commit.gpgsign false
printf '{"version": "7.0.0"}\n' >package.json
git add package.json
git commit -q -m "initial"
git tag -a v7.0.0-alpha.1 -m v7.0.0-alpha.1
check "no new commits since the last tag of this channel: cuts nothing" \
    yes "$(skipped alpha)"
check "the other channel is unaffected by that gate" \
    v7.0.0-rc.1 "$(next_tag rc)"

if [ "$failures" -gt 0 ]; then
    echo "$failures check(s) failed"
    exit 1
fi
echo "all checks passed"
