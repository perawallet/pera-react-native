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

RC_TAG="${RC_TAG:-}"
if [ -z "$RC_TAG" ]; then
  # Version sort, not creation date: two tags cut in the same second order
  # arbitrarily by date, and "the latest rc" should mean the highest version
  # regardless of when it happened to be tagged. Every candidate here carries
  # an -rc.N suffix, so the counters compare numerically.
  RC_TAG=$(git tag --list 'v*-rc.*' --sort=-v:refname | head -n 1)
fi

if [ -z "$RC_TAG" ]; then
  echo "ERROR: no rc tags found — nothing to promote." >&2
  exit 1
fi

case "$RC_TAG" in
  v[0-9]*-rc.[0-9]*) ;;
  *)
    echo "ERROR: '$RC_TAG' is not a release candidate tag (expected vX.Y.Z-rc.N)." >&2
    exit 1
    ;;
esac

if ! git rev-parse -q --verify "refs/tags/${RC_TAG}" >/dev/null 2>&1; then
  echo "ERROR: rc tag '$RC_TAG' does not exist." >&2
  exit 1
fi

STABLE="${RC_TAG%-rc.*}"

# Release tags are immutable once cut: a moved one silently changes what a
# published GitHub Release and an already-shipped store build point at.
if git rev-parse -q --verify "refs/tags/${STABLE}" >/dev/null 2>&1; then
  echo "ERROR: '$STABLE' already exists — promote a newer rc, or delete the tag deliberately." >&2
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

# Hand the tag to the calling workflow so it can publish the GitHub Release.
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "tag=$STABLE" >>"$GITHUB_OUTPUT"
fi

echo "✓ Promoted $RC_TAG to $STABLE"
echo "$STABLE"
