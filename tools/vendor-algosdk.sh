#!/usr/bin/env bash
set -euo pipefail

# tools/vendor-algosdk.sh [git-ref]
#
# Builds algosdk from a git tag and packs the result into libs/, so the
# monorepo can depend on the PQ (Falcon-1024) signature support that Pera's
# quantum accounts need. That support exists only on an unpublished tag —
# v3.7.0-beta.1 of algorand/js-algorand-sdk — and is wired in via the
# `algosdk` entry under `overrides:` in pnpm-workspace.yaml.
#
# Why a packed tarball instead of a git dependency:
#   The tag ships no build output. Its dist/ holds a single file (the ESM
#   `type` marker), while `main` and `types` point at dist/cjs and dist/types,
#   which the package's `prepare` script produces. pnpm rewrites both
#   `github:` and `git+https:` specs to a codeload tarball and then declines to
#   run that build ("has to be built but the build scripts were ignored"), and
#   neither `onlyBuiltDependencies` nor `dangerouslyAllowAllBuilds` lifts it.
#   A git spec therefore installs a package with no entry points at all.
#
# Going back to the published release is a one-line change: drop the `algosdk`
# override from pnpm-workspace.yaml (the catalog range takes over again) and
# delete the tarball from libs/.
#
# Idempotent: re-running rebuilds and overwrites the same tarball in place.

ALGOSDK_REF="${1:-v3.7.0-beta.1}"
ALGOSDK_REPO="https://github.com/algorand/js-algorand-sdk.git"

# The commit v3.7.0-beta.1 pointed at when this was vendored. A tag is mutable,
# so a silent retag would otherwise change what we build without any diff.
# Only enforced for the default ref — an explicit ref is a deliberate override.
EXPECTED_COMMIT="15718f1bace20b8ed752bff60492a95cd81eaf4b"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LIBS_DIR="$ROOT_DIR/libs"

for cmd in git npm node; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "vendor-algosdk: '$cmd' is required but not on PATH." >&2
        exit 1
    fi
done

BUILD_DIR="$(mktemp -d)"
cleanup() { rm -rf "$BUILD_DIR"; }
trap cleanup EXIT

echo "vendor-algosdk: cloning $ALGOSDK_REF"
git clone --quiet --depth 1 --branch "$ALGOSDK_REF" "$ALGOSDK_REPO" "$BUILD_DIR/sdk"

ACTUAL_COMMIT="$(git -C "$BUILD_DIR/sdk" rev-parse HEAD)"
if [ "$ALGOSDK_REF" = "v3.7.0-beta.1" ] && [ "$ACTUAL_COMMIT" != "$EXPECTED_COMMIT" ]; then
    echo "vendor-algosdk: $ALGOSDK_REF now points at $ACTUAL_COMMIT," >&2
    echo "  but this script pins $EXPECTED_COMMIT. The tag was moved." >&2
    echo "  Review the upstream diff before updating EXPECTED_COMMIT." >&2
    exit 1
fi
echo "vendor-algosdk: at $ACTUAL_COMMIT"

cd "$BUILD_DIR/sdk"

# `npm ci` (not pnpm): the SDK has its own package-lock.json, and installing it
# with pnpm inside our workspace would pull it into the monorepo's resolution.
echo "vendor-algosdk: installing build deps"
npm ci --silent

# Run the build explicitly rather than relying on `prepare`. A global
# `ignore-scripts=true` in ~/.npmrc (a common supply-chain-hardening setting,
# see tools/rebuild-native.sh) suppresses lifecycle scripts, so `npm ci` alone
# would leave dist/ empty here.
echo "vendor-algosdk: building"
npm run build --silent

for entry in dist/cjs/index.js dist/esm/index.js dist/types/index.d.ts; do
    if [ ! -f "$entry" ]; then
        echo "vendor-algosdk: build finished but $entry is missing." >&2
        exit 1
    fi
done

mkdir -p "$LIBS_DIR"
TARBALL_NAME="$(npm pack --silent --pack-destination "$LIBS_DIR" | tail -1)"
TARBALL_PATH="$LIBS_DIR/$TARBALL_NAME"

echo "vendor-algosdk: wrote libs/$TARBALL_NAME"
echo "vendor-algosdk: sha256 $(shasum -a 256 "$TARBALL_PATH" | cut -d' ' -f1)"

# The override in pnpm-workspace.yaml names the tarball by version, so a ref
# that packs to a different filename needs that line updated too.
if ! grep -q "libs/$TARBALL_NAME" "$ROOT_DIR/pnpm-workspace.yaml"; then
    echo "vendor-algosdk: NOTE — pnpm-workspace.yaml does not reference" >&2
    echo "  libs/$TARBALL_NAME. Update the 'algosdk' entry under overrides:." >&2
fi

echo "vendor-algosdk: done — run 'pnpm install' to pick it up."
