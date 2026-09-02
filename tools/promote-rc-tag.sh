#!/usr/bin/env bash
set -euo pipefail

# tools/promote-rc-tag.sh
# Cuts a golden release from a release candidate: given v7.0.2-rc.3, tags that
# same commit v7.0.2 and pushes it, which fires Bitrise's release-builds
# pipeline for the production builds.
#
# The commit is the point. An rc has already been built, smoke-covered by the
# nightlies it descends from, and put in front of QA; promotion ships exactly
# that, never whatever has landed on main since.
#
# Env:
#   RC_TAG   rc tag to promote. Defaults to the highest v*-rc.* by version,
#            which is not the newest tag overall — nightlies keep landing on
#            the same base version after an rc is cut.
#   DRY_RUN  when "1": resolve and print, but create nothing (used by tests).
#   NO_PUSH  when "1": create the tag locally but do not push (used by tests).
#
# The caller publishes the GitHub Release itself rather than leaving it to
# github-release.yml: a tag pushed with GITHUB_TOKEN does not trigger further
# workflows, so that workflow's `push: tags` trigger never sees this one.
# create-nightly-tag.sh carries the same caveat.

# Deletes every alpha/rc tag belonging to one stable version, locally and on
# origin. Scoped twice over: the glob pins the version, so the bare stable tag
# and neighbouring versions can never match, and the anchored shape check drops
# hand-cut lookalikes like v7.2.0-rc.1-qa — the same shape the promotion path
# refuses to promote, so it is not ours to delete either.
retire_prereleases() {
  local stable="$1"
  local doomed keep tag main_ref=""

  doomed=$(git tag --list "${stable}-alpha.*" "${stable}-rc.*" |
    grep -E '^v[0-9]+\.[0-9]+\.[0-9]+-(alpha|rc)\.[0-9]+$' | sort -V || true)

  # A prerelease cut from a branch that never merged is the only ref keeping its
  # commit alive, so deleting the tag orphans the commit. The guard above proved
  # reachability for the promoted rc alone; every other tag is checked here.
  if git rev-parse -q --verify refs/remotes/origin/main >/dev/null 2>&1; then
    main_ref=refs/remotes/origin/main
  fi

  keep=""
  while IFS= read -r tag; do
    [ -n "$tag" ] || continue
    if [ -n "$main_ref" ] && ! git merge-base --is-ancestor "$tag" "$main_ref"; then
      echo "Keeping ${tag} — not reachable from origin/main."
      continue
    fi
    keep="${keep}${tag}
"
  done <<EOF
${doomed}
EOF
  doomed=$(printf '%s' "$keep")

  if [ -z "$doomed" ]; then
    echo "No ${stable} prerelease tags to retire."
    return 0
  fi

  echo "Retiring $(printf '%s\n' "$doomed" | grep -c .) prerelease tag(s) for ${stable}:"
  printf '%s\n' "$doomed" | sed 's/^/  /'

  if [ "${NO_PUSH:-}" = "1" ]; then
    echo "NO_PUSH=1 — not deleting them on origin."
    return 0
  fi

  # Never fatal. The stable tag is pushed by now and the release still has to
  # be published; a leftover prerelease tag is cosmetic, a failed release job
  # is not.
  if ! printf '%s\n' "$doomed" | xargs git push origin --delete; then
    echo "WARNING: could not delete some ${stable} prerelease tags on origin — remove them by hand." >&2
    return 0
  fi

  printf '%s\n' "$doomed" | xargs -n 1 git tag -d >/dev/null 2>&1 || true
}

RC_TAG="${RC_TAG:-}"
if [ -z "$RC_TAG" ]; then
  # Version sort, not creation date: two tags cut in the same second order
  # arbitrarily by date, and "the latest rc" should mean the highest version
  # regardless of when it happened to be tagged. Every candidate here carries
  # an -rc.N suffix, so the counters compare numerically.
  # Shape-filtered before the sort: a hand-cut v7.1.4-rc.1-qa sorts ABOVE the
  # real v7.1.4-rc.1 under -v:refname, and would be promoted in its place.
  RC_TAG=$(git tag --list 'v*-rc.*' --sort=-v:refname |
    grep -E '^v[0-9]+\.[0-9]+\.[0-9]+-rc\.[0-9]+$' | head -n 1 || true)
fi

if [ -z "$RC_TAG" ]; then
  echo "ERROR: no rc tags found — nothing to promote." >&2
  exit 1
fi

# Exact shape, not a glob: the sibling scripts all anchor this, and a loose
# match lets a suffixed tag through to be released from the wrong commit.
if ! printf '%s' "$RC_TAG" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+-rc\.[0-9]+$'; then
  echo "ERROR: '$RC_TAG' is not a release candidate tag (expected vX.Y.Z-rc.N)." >&2
  exit 1
fi

if ! git rev-parse -q --verify "refs/tags/${RC_TAG}" >/dev/null 2>&1; then
  echo "ERROR: rc tag '$RC_TAG' does not exist." >&2
  exit 1
fi

STABLE="${RC_TAG%-rc.*}"

# Release tags are immutable once cut: a moved one silently changes what a
# published GitHub Release and an already-shipped store build point at.
if git rev-parse -q --verify "refs/tags/${STABLE}" >/dev/null 2>&1; then
  echo "ERROR: '$STABLE' already exists — promote a newer rc." >&2
  exit 1
fi

# Existence is not monotonicity. A stable tag that was never cut, or was deleted,
# leaves a hole below the newest release, and an rc cut on that stale base passes
# the check above — promoting it publishes a production build numbered BELOW what
# already shipped. Stores accept it, because versionCode keeps climbing.
NEWEST_STABLE=$(git tag --list 'v*' --sort=-v:refname |
  grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1 || true)
if [ -n "$NEWEST_STABLE" ] &&
  [ "$(printf '%s\n%s\n' "$NEWEST_STABLE" "$STABLE" | sort -V | tail -n 1)" != "$STABLE" ]; then
  echo "ERROR: $STABLE is not above the newest shipped stable $NEWEST_STABLE — the rc was cut on a stale base." >&2
  exit 1
fi

RC_SHA=$(git rev-list -n 1 "$RC_TAG")

# Guards against promoting an rc cut from a branch that never merged. Skipped
# when there is no origin/main to compare against, as in the test repo.
if git rev-parse -q --verify refs/remotes/origin/main >/dev/null 2>&1; then
  if ! git merge-base --is-ancestor "$RC_SHA" refs/remotes/origin/main; then
    echo "ERROR: $RC_TAG ($RC_SHA) is not reachable from origin/main." >&2
    exit 1
  fi
fi

echo "Promoting $RC_TAG ($RC_SHA) to $STABLE"

if [ "${DRY_RUN:-}" = "1" ]; then
  echo "DRY_RUN=1 — not creating or pushing $STABLE."
  echo "$STABLE"
  exit 0
fi

git config user.name "Pera CI"
git config user.email "ci@perawallet.app"
git tag -a "$STABLE" -m "$STABLE" "$RC_SHA"

if [ "${NO_PUSH:-}" != "1" ]; then
  git push origin "$STABLE"
fi

# --- Retire this version's prereleases ------------------------------------
# The alpha/rc tags exist only to feed Bitrise during the cycle, and they
# accumulate (7.1.2 collected thirteen before it was cleaned up by hand). Safe
# to remove here and nowhere else:
#   - prereleases never carry a GitHub Release (github-release.yml is
#     stable-only), so deleting the tag leaves nothing dangling;
#   - anything not reachable from origin/main is kept, so deleting a tag can
#     never orphan the commit it was the last ref to;
#   - create-nightly-tag.sh derives the next base from the newest *stable* tag,
#     not from the prerelease counter, so removing them cannot make the next
#     nightly reuse a name it has already built.
# One consequence, accepted: that script's change gate asks "any new commits
# since the last tag of this channel", so with this version's alphas gone the
# first nightly after a release compares against the previous cycle's tag and
# cuts one redundant tag for a commit it already built. It self-corrects the
# next night. Gating on the stable tag instead does not fix it — nightlies keep
# landing after an rc is cut, so the stable is behind the last alpha, which is
# the very tag being deleted.
# Runs after the stable push on purpose: if that failed we have not shipped,
# and the prereleases are still the only record of the cycle.
retire_prereleases "$STABLE"

# Hand the tag to the calling workflow so it can publish the GitHub Release.
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "tag=$STABLE" >>"$GITHUB_OUTPUT"
fi

echo "✓ Promoted $RC_TAG to $STABLE"
echo "$STABLE"
