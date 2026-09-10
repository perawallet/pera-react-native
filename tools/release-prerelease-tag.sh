#!/usr/bin/env bash
set -euo pipefail

# tools/release-prerelease-tag.sh
# Mints a prerelease tag (vX.Y.Z-<channel>.N) on the current HEAD and pushes it
# to origin, which triggers the release-builds pipeline (prod + staging). Run
# from GitHub Actions: nightly on the alpha channel, weekly on the rc channel.
# Idempotent: if there are no new commits since the last tag of the same
# channel, exits 0 without creating a tag.
#
# Env:
#   CHANNEL  prerelease channel: "alpha" (nightly, default) or "rc" (weekly
#            release candidate). Both share the same base-version logic.
#   DRY_RUN  when "1": compute and print the tag + gate decision but do NOT
#            create or push the tag (used by tests).
#   PKG_JSON override path to package.json (used by tests; defaults to the
#            mobile app's package.json).
#
# Version source: apps/mobile/package.json .version, base part before any
# prerelease suffix (e.g. "7.0.0-alpha" -> "7.0.0").

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_JSON="${PKG_JSON:-$ROOT_DIR/apps/mobile/package.json}"

VERSION=$(jq -r '.version | split("-")[0]' "$PKG_JSON")
if [ -z "$VERSION" ] || [ "$VERSION" = "null" ]; then
  echo "ERROR: could not read version from $PKG_JSON" >&2
  exit 1
fi

# --- Prerelease channel: alpha (nightly, default) or rc (weekly) ---
CHANNEL="${CHANNEL:-alpha}"
case "$CHANNEL" in
  alpha | rc) ;;
  *)
    echo "ERROR: CHANNEL must be 'alpha' or 'rc' (got '$CHANNEL')" >&2
    exit 1
    ;;
esac

# --- Base version: the version prereleases are cut against ---
# Start from package.json. If that version has already shipped as a STABLE tag
# (vX.Y.Z, no suffix), the next dev cycle is the next patch, so prereleases roll
# to vX.Y.(Z+1). Until that stable tag exists, stay on the package.json version —
# so the first prerelease is v7.0.0-alpha.1, not v7.0.1-alpha.1. alpha and rc
# share this base, so an rc is always a candidate for the same version the
# nightlies are building toward.
#
# Anchored on the NEWEST shipped stable, not on whether package.json's own
# version happens to be tagged. package.json is not bumped as part of releasing,
# so it drifts several releases behind, and the stable tags are not contiguous —
# a deleted or never-cut vX.Y.Z leaves a hole. Asking "is this exact tag taken?"
# and stepping one patch at a time stops in that hole and cuts every prerelease
# against a base BELOW what is already in users' hands. Take max(stable) + 1.
#
# The exact-shape grep is load-bearing twice over: it keeps prereleases of a
# higher version out of the maximum, and it drops anything that is not vX.Y.Z,
# which would otherwise sort above every real tag under -v:refname.
NEWEST_STABLE=$(git tag --list 'v*' --sort=-v:refname |
  grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1 || true)
BASE="$VERSION"
if [ -n "$NEWEST_STABLE" ] &&
  [ "$(printf '%s\n%s\n' "${NEWEST_STABLE#v}" "$VERSION" | sort -V | tail -n 1)" = "${NEWEST_STABLE#v}" ]; then
  IFS='.' read -r _maj _min _pat <<<"${NEWEST_STABLE#v}"
  BASE="${_maj}.${_min}.$((_pat + 1))"
  echo "Newest shipped stable is ${NEWEST_STABLE} — prereleases target v${BASE}."
fi

# --- Change gate: any new commits since the last tag of this channel? ---
LAST_TAG=$(git tag --list "v*-${CHANNEL}.*" --sort=-creatordate | head -n 1)
if [ -n "$LAST_TAG" ]; then
  NEW_COMMITS=$(git rev-list "${LAST_TAG}..HEAD" --count)
  if [ "$NEW_COMMITS" -eq 0 ]; then
    echo "No new commits since last ${CHANNEL} tag $LAST_TAG — skipping."
    exit 0
  fi
  echo "$NEW_COMMITS new commit(s) since $LAST_TAG."
else
  echo "No existing ${CHANNEL} tags — creating the first one."
fi

# --- Counter: max existing v${BASE}-${CHANNEL}.N + 1 (numeric), reset per base+channel ---
PREFIX="v${BASE}-${CHANNEL}."
MAX=0
while IFS= read -r tag; do
  [ -n "$tag" ] || continue
  suffix="${tag#"$PREFIX"}"
  case "$suffix" in
    '' | *[!0-9]*) continue ;; # skip non-numeric / malformed suffixes
  esac
  suffix=$((10#$suffix)) # force base-10 (a leading-zero suffix like 09 is NOT octal)
  if [ "$suffix" -gt "$MAX" ]; then
    MAX="$suffix"
  fi
done < <(git tag --list "${PREFIX}*")
A=$((MAX + 1))

TAG="v${BASE}-${CHANNEL}.${A}"
echo "Next ${CHANNEL} tag: $TAG"

if [ "${DRY_RUN:-}" = "1" ]; then
  echo "DRY_RUN=1 — not creating or pushing $TAG."
  exit 0
fi

git config user.name "Pera CI"
git config user.email "ci@perawallet.app"
git tag -a "$TAG" -m "$TAG"
git push origin "$TAG"

# Hand the tag to the calling workflow so it can publish a GitHub Release for
# it. A tag pushed with GITHUB_TOKEN does not trigger further workflows, so a
# `push: tags` trigger would never see this one — the release has to be created
# by the job that minted it. No output means no tag was cut.
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "tag=$TAG" >>"$GITHUB_OUTPUT"
fi

echo "✓ Created and pushed $TAG"
