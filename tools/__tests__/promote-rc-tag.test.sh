#!/usr/bin/env bash
set -uo pipefail

# Promotion tags a commit that was already built and tested as an rc. The
# failure that matters is tagging the wrong one — HEAD instead of the rc's
# commit would ship whatever landed since, unbuilt and untested.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/promote-rc-tag.sh"
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

# v7.0.0 already promoted; 7.0.1 has rcs; 7.0.2 has an alpha after its rc, so
# the newest tag overall is NOT the newest rc.
for tag in v7.0.0-rc.1 v7.0.0 v7.0.1-alpha.1 v7.0.1-rc.1 v7.0.1-rc.2 v7.0.2-alpha.1; do
    git commit -q --allow-empty -m "work before ${tag}"
    git tag -a "$tag" -m "$tag"
done
git commit -q --allow-empty -m "work before v7.0.2-rc.1"
git tag -a v7.0.2-rc.1 -m v7.0.2-rc.1
RC_SHA=$(git rev-list -n1 v7.0.2-rc.1)

# Commits landing after the rc are exactly what promotion must not pick up.
git commit -q --allow-empty -m "landed after the rc, not in the build"
git commit -q --allow-empty -m "also not in the build"
git tag -a v7.0.2-alpha.2 -m v7.0.2-alpha.2

check "defaults to the newest rc, not the newest tag" "v7.0.2" \
    "$(DRY_RUN=1 "$SCRIPT" 2>/dev/null | tail -1)"

check "honours an explicit older rc" "v7.0.1" \
    "$(DRY_RUN=1 RC_TAG=v7.0.1-rc.2 "$SCRIPT" 2>/dev/null | tail -1)"

check "refuses an rc that does not exist" "1" \
    "$(DRY_RUN=1 RC_TAG=v9.9.9-rc.1 "$SCRIPT" >/dev/null 2>&1; echo $?)"

check "refuses when the stable tag already exists" "1" \
    "$(DRY_RUN=1 RC_TAG=v7.0.0-rc.1 "$SCRIPT" >/dev/null 2>&1; echo $?)"

check "refuses a tag that is not an rc" "1" \
    "$(DRY_RUN=1 RC_TAG=v7.0.2-alpha.1 "$SCRIPT" >/dev/null 2>&1; echo $?)"

check "dry run creates no tag" "" \
    "$(git tag --list v7.0.2)"

# No origin configured, so the push is what a real run would do last; check
# the tag landed on the right commit before it.
NO_PUSH=1 "$SCRIPT" >/dev/null 2>&1
check "tags the rc's commit, not HEAD" "$RC_SHA" "$(git rev-list -n1 v7.0.2 2>/dev/null)"
check "the tag is annotated" "tag" "$(git cat-file -t v7.0.2 2>/dev/null)"

# Second run must be a no-op rather than moving a shipped release tag.
check "refuses to re-promote an already promoted version" "1" \
    "$(NO_PUSH=1 "$SCRIPT" >/dev/null 2>&1; echo $?)"

# --- Isolated repos: the cases below need their own tag sets, not the one above.
fresh_repo() { # $1... tags to create in order
    ALT=$(mktemp -d)
    cd "$ALT" || exit 1
    git init -q .
    git config user.email t@t.t
    git config user.name t
    git config commit.gpgsign false
    git commit -q --allow-empty -m initial
    for tag in "$@"; do
        git commit -q --allow-empty -m "work before ${tag}"
        git tag -a "$tag" -m "$tag"
    done
}

# A stable that was never cut (or was deleted) leaves a hole BELOW the newest
# release. Tag existence alone lets an rc on that stale base promote to a
# version under what already shipped — a regressive production release, which
# the stores accept because versionCode keeps climbing. This is origin's real
# shape: v7.1.2-rc.4 present, bare v7.1.2 absent, v7.1.3 shipped.
fresh_repo v7.1.1 v7.1.2-rc.4 v7.1.3
check "refuses an rc whose stable would sit below the newest shipped" "1" \
    "$(DRY_RUN=1 "$SCRIPT" >/dev/null 2>&1; echo $?)"
case "$(DRY_RUN=1 "$SCRIPT" 2>&1)" in
    *"not above the newest shipped stable"*) echo "  ok    and names the newest shipped stable" ;;
    *)
        echo "  FAIL  and names the newest shipped stable"
        failures=$((failures + 1))
        ;;
esac

# A hand-cut lookalike sorts ABOVE the real rc under -v:refname.
fresh_repo v7.1.4-rc.1 v7.1.4-rc.1-qa
check "a suffixed lookalike is not resolved as the rc to promote" "v7.1.4" \
    "$(DRY_RUN=1 "$SCRIPT" 2>/dev/null | tail -1)"
check "an explicitly named malformed rc is rejected" "1" \
    "$(DRY_RUN=1 RC_TAG=v7.1.4-rc.1-qa "$SCRIPT" >/dev/null 2>&1; echo $?)"

cd "$REPO" || exit 1

if [ "$failures" -gt 0 ]; then
    echo "promote-rc-tag: ${failures} failure(s)"
    exit 1
fi
echo "promote-rc-tag: all checks passed"
