#!/usr/bin/env bash
set -euo pipefail

# tools/create-nightly-tag.sh
# Mints a nightly tag (vX.Y.Z-nightly.A) on the current HEAD and pushes it to
# origin, which triggers the release-builds pipeline. Runs in the qa-builds
# pipeline (scheduled on main). Idempotent: if there are no new commits since
# the last nightly tag, exits 0 without creating a tag.
#
# Env:
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

# --- Change gate: any new commits since the last nightly tag? ---
LAST_NIGHTLY=$(git tag --list 'v*-nightly.*' --sort=-creatordate | head -n 1)
if [ -n "$LAST_NIGHTLY" ]; then
  NEW_COMMITS=$(git rev-list "${LAST_NIGHTLY}..HEAD" --count)
  if [ "$NEW_COMMITS" -eq 0 ]; then
    echo "No new commits since last nightly tag $LAST_NIGHTLY — skipping."
    exit 0
  fi
  echo "$NEW_COMMITS new commit(s) since $LAST_NIGHTLY."
else
  echo "No existing nightly tags — creating the first one."
fi

# --- Counter: max existing v${VERSION}-nightly.N + 1 (numeric), reset per version ---
PREFIX="v${VERSION}-nightly."
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

TAG="v${VERSION}-nightly.${A}"
echo "Next nightly tag: $TAG"

if [ "${DRY_RUN:-}" = "1" ]; then
  echo "DRY_RUN=1 — not creating or pushing $TAG."
  exit 0
fi

git config user.name "Pera CI"
git config user.email "ci@perawallet.app"
git tag -a "$TAG" -m "Nightly build $TAG"
git push origin "$TAG"
echo "✓ Created and pushed $TAG"
