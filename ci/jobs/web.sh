#!/usr/bin/env bash
set -euxo pipefail

# Mirrors bitrise.yml's _web-build: a zip only. There is no Chrome Web Store
# upload on either CI, so CI_UPLOADS_ENABLED changes nothing here.

source ci/jobs/lib/toolchain.sh
use_pinned_node
install_pinned_pnpm

./tools/validate-env.sh
pnpm install --frozen-lockfile --prefer-offline
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
SHA=$(printf '%s' "$CI_SHA" | cut -c1-7)
NAME="pera-extension-web-${ENVIRONMENT}-${CI_TAG}-${SHA}.zip"
(cd apps/browser/dist && zip -r "$CI_ARTIFACT_DIR/$NAME" .)
