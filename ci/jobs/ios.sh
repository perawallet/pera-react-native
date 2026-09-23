#!/usr/bin/env bash
set -euxo pipefail

source ci/jobs/lib/toolchain.sh
source ci/jobs/lib/ios-keychain.sh
use_pinned_node
use_pinned_ruby

cleanup_signing() {
  ios_keychain_teardown
  # Tracked with a committed placeholder, so restored rather than removed: the
  # real Firebase config would otherwise sit in the tree as a modification.
  git checkout -- apps/mobile/config/GoogleService-Info.plist 2>/dev/null || true
}
trap cleanup_signing EXIT

# Secret values are single-line only on the daemon, and the App Store Connect
# key is a multi-line .p8, so it is stored base64-encoded and decoded into the
# name validate-env.sh and the Fastfile read.
set +x
echo "pera-ci: decoding APP_STORE_CONNECT_API_KEY_CONTENT_BASE64"
APP_STORE_CONNECT_API_KEY_CONTENT=$(printf '%s' "$APP_STORE_CONNECT_API_KEY_CONTENT_BASE64" | base64 --decode)
export APP_STORE_CONNECT_API_KEY_CONTENT
set -x

install_pinned_pnpm

./tools/validate-env.sh
pnpm install --frozen-lockfile --prefer-offline
APP_ENV="$ENVIRONMENT" pnpm run generate:config
# build:packages re-runs generate-config.sh, so APP_ENV is needed again.
APP_ENV="$ENVIRONMENT" pnpm run build:packages

# app.config.builder.js bakes both into the generated native project, so they
# must be set before prebuild. See android.sh for why the offset exists; it
# applies equally to TestFlight, which rejects a non-increasing build number.
APP_VERSION=$(resolve_app_version)
export APP_VERSION
BUILD_NUMBER=$((CI_RUN_ID + ${BUILD_NUMBER_OFFSET:-0}))
export BUILD_NUMBER

# Must land before prebuild, which copies it into the native project. Skipping
# it wouldn't fail the build; it would ship the placeholder's Firebase project.
set +x
echo "pera-ci: decoding IOS_GOOGLE_SERVICE_INFO_BASE64"
printf '%s' "$IOS_GOOGLE_SERVICE_INFO_BASE64" | base64 --decode > apps/mobile/config/GoogleService-Info.plist
set -x

(cd apps/mobile && bundle install)

# The expo:prebuild script without its Android half. Pods go through bundler
# so the Gemfile's CocoaPods pin applies rather than whatever `pod` is on PATH.
pnpm --filter mobile exec expo prebuild --no-install --no-clean --platform ios
pnpm --filter mobile exec node scripts/fix-development-team.js
(cd apps/mobile/ios && bundle exec pod install)

ios_keychain_setup

# Every run is a fresh checkout at a new path, and Xcode keys DerivedData by
# path, so the default location would accrue several GB in ~/Library per run.
# Inside the workspace it is removed when the daemon prunes the run.
export GYM_DERIVED_DATA_PATH="$CI_WORKSPACE/apps/mobile/build/DerivedData"

SKIP_UPLOAD=true
if [ "${CI_UPLOADS_ENABLED:-false}" = "true" ]; then
  SKIP_UPLOAD=false
fi

# The Fastfile only authenticates to App Store Connect when is_ci, which reads
# CI; the daemon doesn't set it.
(cd apps/mobile && CI=true bundle exec fastlane ios deploy_testflight \
  "scheme:$IOS_SCHEME" clean:true "skip_upload:$SKIP_UPLOAD")

SHA=$(printf '%s' "$CI_SHA" | cut -c1-7)
NAME="pera-ios-${ENVIRONMENT}-${CI_TAG}-${SHA}"
cp "apps/mobile/build/ios/${IOS_SCHEME}.ipa" "$CI_ARTIFACT_DIR/${NAME}.ipa"
# Kept so a shipped build can be re-symbolicated. gym names the zip after the
# app product, not the scheme, hence the glob.
for dsym in apps/mobile/build/ios/*.dSYM.zip; do
  [ -f "$dsym" ] || continue
  cp "$dsym" "$CI_ARTIFACT_DIR/${NAME}-$(basename "$dsym")"
done
