#!/usr/bin/env bash
set -uo pipefail

# Promotion tags a commit that was already built and tested as an rc. The
# failure that matters is tagging the wrong one — HEAD instead of the rc's
# commit would ship whatever landed since, unbuilt and untested.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/promote-rc-tag.sh"
REPO=$(mktemp -d)
SCRATCH="$REPO"
trap 'rm -rf $SCRATCH' EXIT

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
# Same, but with a real bare origin, so the prerelease cleanup's push can be
# observed rather than inferred.
fresh_repo_with_origin() { # $1... tags to create in order
    ALT=$(mktemp -d)
    REMOTE=$(mktemp -d)
    SCRATCH="$SCRATCH $ALT $REMOTE"
    git init -q --bare "$REMOTE"
    cd "$ALT" || exit 1
    git init -q -b main .
    git config user.email t@t.t
    git config user.name t
    git config commit.gpgsign false
    git remote add origin "$REMOTE"
    git commit -q --allow-empty -m initial
    for tag in "$@"; do
        git commit -q --allow-empty -m "work before ${tag}"
        git tag -a "$tag" -m "$tag"
    done
    git push -q origin main --tags
    git fetch -q origin
}

# Stands in for a tag protection rule: creates are accepted, deletes are not.
# receive.denyDeletes is not honoured over a local path, so use a hook.
refuse_deletes() { # $1 bare repo
    cat >"$1/hooks/pre-receive" <<'HOOK'
#!/bin/sh
while read -r _old new _ref; do
  case "$new" in
    *[!0]*) ;;
    *) echo "remote: deletes are refused" >&2; exit 1 ;;
  esac
done
exit 0
HOOK
    chmod +x "$1/hooks/pre-receive"
}

fresh_repo() { # $1... tags to create in order
    ALT=$(mktemp -d)
    SCRATCH="$SCRATCH $ALT"
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

# Promotion is the only moment a version's prereleases become dead weight, and
# they pile up — 7.1.2 collected thirteen before being cleaned up by hand.
fresh_repo_with_origin v7.2.0-alpha.1 v7.2.0-alpha.2 v7.2.0-rc.1 v7.3.0-alpha.1
"$SCRIPT" >/dev/null 2>&1
check "keeps the stable tag it just cut" "v7.2.0" "$(git tag --list v7.2.0)"
check "and keeps it on origin" "v7.2.0" \
    "$(git ls-remote --tags origin 'refs/tags/v7.2.0' | sed 's|.*refs/tags/||')"
check "retires the promoted version's prereleases locally" "" \
    "$(git tag --list 'v7.2.0-*')"
check "retires them on origin too" "" \
    "$(git ls-remote --tags origin 'refs/tags/v7.2.0-*' | grep -v '\^{}')"
# The glob is scoped by exact version: another line's prereleases are not ours
# to retire, and a stable release must never disturb an unrelated cycle.
check "leaves another version's prereleases alone" "v7.3.0-alpha.1" \
    "$(git tag --list 'v7.3.0-*')"

fresh_repo v7.6.0-alpha.1 v7.6.0-rc.1
case "$(NO_PUSH=1 "$SCRIPT" 2>&1)" in
    *"NO_PUSH=1 — not deleting them on origin."*) no_push_result=held ;;
    *) no_push_result=deleted ;;
esac
check "NO_PUSH reports the prereleases without deleting them" "held" "$no_push_result"
check "and leaves them in place" "2" "$(git tag --list 'v7.6.0-*' | grep -c .)"

# A hand-cut tag is not a prerelease this script produced, and the promotion
# path already refuses to promote one — so it is not ours to delete either.
fresh_repo_with_origin v7.4.0-alpha.1 v7.4.0-rc.1
git tag -a v7.4.0-rc.1-qa -m v7.4.0-rc.1-qa
git push -q origin v7.4.0-rc.1-qa
"$SCRIPT" >/dev/null 2>&1
check "spares a hand-cut lookalike" "v7.4.0-rc.1-qa" "$(git tag --list 'v7.4.0-*')"

# A prerelease cut off main is the only ref holding its commit; deleting the
# tag would orphan it, so it stays even though the version matches.
fresh_repo_with_origin v7.5.0-rc.1
git checkout -q -b side
git commit -q --allow-empty -m "never merged"
git tag -a v7.5.0-alpha.9 -m v7.5.0-alpha.9
git checkout -q main
"$SCRIPT" >/dev/null 2>&1
check "keeps a prerelease unreachable from origin/main" "v7.5.0-alpha.9" \
    "$(git tag --list 'v7.5.0-alpha.*')"
check "and still retires the reachable one" "" "$(git tag --list 'v7.5.0-rc.*')"

# A remote that refuses deletes stands in for tag protection or a token without
# the reach. The local tags have to survive it, or the leftovers on origin
# become invisible from a clone.
fresh_repo_with_origin v7.7.0-alpha.1 v7.7.0-rc.1
refuse_deletes "$REMOTE"
out=$("$SCRIPT" 2>&1)
case "$out" in
    *"could not delete some v7.7.0 prerelease tags on origin"*) warned=yes ;;
    *) warned=no ;;
esac
check "warns when origin refuses the delete" "yes" "$warned"
check "does not fail the release over it" "v7.7.0" "$(git tag --list v7.7.0)"
check "and keeps the local tags so the leftovers stay visible" "2" \
    "$(git tag --list 'v7.7.0-alpha.*' 'v7.7.0-rc.*' | grep -c .)"

cd "$REPO" || exit 1

if [ "$failures" -gt 0 ]; then
    echo "promote-rc-tag: ${failures} failure(s)"
    exit 1
fi
echo "promote-rc-tag: all checks passed"
