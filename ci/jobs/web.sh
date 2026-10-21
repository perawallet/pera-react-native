#!/usr/bin/env bash
set -euxo pipefail

# Mirrors bitrise.yml's web-production: the zip, its signed CRX when the key is
# set, then on a production release tag the upload to the Chrome Web Store as a
# draft.

source ci/jobs/lib/toolchain.sh
use_pinned_node
install_pinned_pnpm

./tools/dev/validate-env.sh
pnpm install --frozen-lockfile --prefer-offline

# tools/dev/generate-config.sh bakes these into releaseTag/appBuildNumber, as Bitrise
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

# With the signing key, a production build also carries the signed CRX, which
# is what gets uploaded: once Verified CRX Uploads is on, the store rejects the
# zip. ${...:+set} keeps the key itself out of the set -x trace.
PACKAGE="$CI_ARTIFACT_DIR/$NAME"
if [ "$ENVIRONMENT" = "production" ] && [ -n "${CWS_CRX_SIGNING_KEY_BASE64:+set}" ]; then
  node tools/release/sign-extension-crx.mjs "$PACKAGE"
  PACKAGE="${PACKAGE%.zip}.crx"
fi

# Behind CI_UPLOADS_ENABLED like the mobile uploads: while Bitrise still
# uploads the same tag, a second upload would replace its draft. Staging never
# uploads; its zip talks to the staging backend.
if [ "${CI_UPLOADS_ENABLED:-false}" = "true" ] && [ "$ENVIRONMENT" = "production" ]; then
  pnpm run release:upload-chrome-web-store "$PACKAGE"
else
  echo "pera-ci: uploads disabled or not production; no Chrome Web Store upload"
fi
