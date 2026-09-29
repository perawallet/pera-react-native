#!/usr/bin/env bash
set -euxo pipefail

# Mirrors bitrise.yml's _web-build: a zip only. There is no Chrome Web Store
# upload on either CI, so CI_UPLOADS_ENABLED changes nothing here.

source ci/jobs/lib/toolchain.sh
use_pinned_node
install_pinned_pnpm

./tools/validate-env.sh
pnpm install --frozen-lockfile --prefer-offline

# generate-config.sh bakes these into releaseTag/appBuildNumber, as Bitrise
# sets them natively. An rc ships as its stable version, as on Bitrise.
export BITRISE_GIT_TAG="${CI_TAG%%-rc.*}"
# See android.sh for why the offset exists; the Chrome Web Store likewise
# rejects an upload whose version isn't higher than the last.
BUILD_NUMBER=$((CI_RUN_ID + ${BUILD_NUMBER_OFFSET:-0}))
export BUILD_NUMBER
export BITRISE_BUILD_NUMBER="$BUILD_NUMBER"
# apps/browser/scripts/build.mjs stamps the manifest from these, so the
# extension carries the app's version: 7.1.8.<build number>, and -alpha.N in
# the display-only version_name. Off a tag APP_VERSION is empty and the
# version comes from apps/browser/package.json.
export APP_VERSION="${BITRISE_GIT_TAG#v}"

APP_ENV="$ENVIRONMENT" pnpm run generate:config

# Unlike the mobile build, the extension also depends on workspace packages
# under extensions/*. --filter=...browser walks the real dependency graph, so
# it picks those up; `browser` is the package name, not the directory.
APP_ENV="$ENVIRONMENT" pnpm exec turbo run build --filter=...browser
pnpm --filter browser bundle

# ENVIRONMENT is in the name because staging and production build the same
# commit from the same tag: without it the two zips are indistinguishable once
# downloaded, and a staging zip installed by mistake looks exactly like a
# broken production build.
# A branch build, which has no tag, is named by its build number, as on Bitrise.
SHA=$(printf '%s' "$CI_SHA" | cut -c1-7)
NAME="pera-extension-web-${ENVIRONMENT}-${CI_TAG:-b$BUILD_NUMBER}-${SHA}.zip"
(cd apps/browser/dist && zip -r "$CI_ARTIFACT_DIR/$NAME" .)
# The hash beside the zip, as Bitrise's _web-build writes it: what a store
# upload or a reviewer checks the zip against. shasum rather than
# sha256sum, which macOS does not ship.
(cd "$CI_ARTIFACT_DIR" && shasum -a 256 "$NAME" >"$NAME.sha256")
cat "$CI_ARTIFACT_DIR/$NAME.sha256"
