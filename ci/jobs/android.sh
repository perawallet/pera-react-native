#!/usr/bin/env bash
set -euxo pipefail

source ci/jobs/lib/toolchain.sh
use_pinned_node

# `export VAR=$(cmd)` takes export's own exit status, not cmd's: under set -e
# a failing java_home would silently leave JAVA_HOME empty instead of aborting
# the job. Assign first, export second.
JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 17)}"
export JAVA_HOME

# tools/resolve-distribution.sh reads this to choose Play vs Firebase. Without
# it every build silently resolves to the fallback channel.
export BITRISE_GIT_TAG="$CI_TAG"

# Decoded secrets land under these paths and nothing else removes them — not
# on success, not on failure, not on the early `exit 0` below. Declared before
# anything is decoded so the EXIT trap covers a failure mid-decode too.
PERA_SECRET_FILES=(
  apps/mobile/config/release.keystore
  apps/mobile/config/firebase-service-account.json
  apps/mobile/config/api-key.json
)
cleanup_secret_files() {
  rm -f "${PERA_SECRET_FILES[@]}"
  # google-services.json is tracked with a committed placeholder, so it is
  # restored rather than removed: the decode above replaces it with the real
  # Firebase project's config, which would otherwise sit in the tree as a
  # modification someone could commit.
  git checkout -- apps/mobile/config/google-services.json 2>/dev/null || true
}
trap cleanup_secret_files EXIT

install_pinned_pnpm

# Rollout step 1 is comparing these artifacts against Bitrise's for the same
# tag, so both the gradle-only and the fastlane path must leave something
# behind. Per-ABI splits and gradle's intermediates produce several files
# sharing a basename, which a flat `cp` would silently reduce to one, so each
# copy is named after its path under the android project.
collect_artifacts() {
  find apps/mobile/android -type f \( -name '*.apk' -o -name '*.aab' \) -newer package.json |
    while IFS= read -r file; do
      cp "$file" "$CI_ARTIFACT_DIR/$(printf '%s' "${file#apps/mobile/android/}" | tr '/' '_')"
    done
}

./tools/validate-env.sh
pnpm install --frozen-lockfile --prefer-offline
APP_ENV="$ENVIRONMENT" pnpm run generate:config

# Workspace packages resolve to dist/ (packages/config/package.json has no
# react-native/source field) and metro.config.js doesn't alias @perawallet/*,
# so Metro can't resolve them during assembleRelease without this build.
# Matches bitrise.yml's "Build packages" step, including re-deriving APP_ENV
# (build:packages re-runs generate-config.sh internally).
APP_ENV="$ENVIRONMENT" pnpm run build:packages

# app.config.builder.js reads both to bake the version into the generated
# native project, so they must be set before expo:prebuild.
APP_VERSION=$(resolve_app_version)
export APP_VERSION
# CI_RUN_ID starts at 1 on the daemon, while Bitrise's BITRISE_BUILD_NUMBER is
# already in the thousands. Without an offset above Bitrise's last build
# number, the first upload-enabled run here produces a versionCode BELOW
# what's already live, and Play rejects the upload as non-increasing.
# BUILD_NUMBER_OFFSET (ci/pipelines.yml) must be raised past that counter
# before CI_UPLOADS_ENABLED is turned on for this pipeline.
BUILD_NUMBER=$((CI_RUN_ID + ${BUILD_NUMBER_OFFSET:-0}))
export BUILD_NUMBER

# Decoded from a secret, not committed. Must land before expo:prebuild:
# app.config.builder.js points Android's googleServicesFile at this exact
# path, and prebuild is what copies it into the generated native project. A
# committed placeholder exists at this path for local dev; skipping this
# step wouldn't fail the build, it would silently ship the placeholder's
# Firebase project instead of the real one.
set +x
echo "$ANDROID_GOOGLE_SERVICES_BASE64" | base64 --decode > apps/mobile/config/google-services.json
set -x

# apps/mobile/android/ is generated, not checked in. --no-install --no-clean
# is deliberate (skip JS deps + CocoaPods, apply to the existing native
# folder rather than recreate it), so keep those flags rather than dropping
# them — but call expo directly with --platform android instead of running
# the expo:prebuild package script. That script's last step is
# `pnpm dlx pod-install ios`, which no-ops on Bitrise's Ubuntu runner; on this
# darwin signing host it doesn't, so an Android-only build was fetching the
# CocoaPods spec repo and installing the full iOS pod set for no reason.
pnpm --filter mobile exec expo prebuild --no-install --no-clean --platform android
pnpm --filter mobile exec node scripts/fix-development-team.js

# Decoded from secrets, not committed. Each decode gets its own set +x/set -x
# bracket (rather than one bracket for all three) with the secret's name
# echoed first: with tracing off, a failure here would otherwise be
# unattributable — the last traced line is "+ set +x" and base64 names
# neither the file nor the secret on error.
set +x
echo "pera-ci: decoding ANDROID_KEYSTORE_BASE64"
echo "$ANDROID_KEYSTORE_BASE64" | base64 --decode > apps/mobile/config/release.keystore
set -x

set +x
echo "pera-ci: decoding FIREBASE_SERVICE_ACCOUNT_BASE64"
echo "$FIREBASE_SERVICE_ACCOUNT_BASE64" | base64 --decode > apps/mobile/config/firebase-service-account.json
set -x

# Only required for a Play upload (tools/resolve-distribution.sh resolving to
# "play"); a Firebase-only build legitimately doesn't have this secret, so
# check presence rather than requiring it unconditionally.
# Written verbatim, matching bitrise.yml's "Setup distribution credentials"
# step: the secret is raw JSON, not base64 — unlike every other name here,
# it has no _BASE64 suffix. Decoding it errors out (this isn't valid base64),
# which used to abort the job before this branch was even reached.
if [ -n "${ANDROID_JSON_KEY_FILE:-}" ]; then
  set +x
  echo "pera-ci: writing ANDROID_JSON_KEY_FILE"
  echo "$ANDROID_JSON_KEY_FILE" > apps/mobile/config/api-key.json
  set -x
fi

DISTRIBUTION=$(./tools/resolve-distribution.sh)
export DISTRIBUTION

# The Fastfile reads ENV["RELEASE_NOTES"] for both the Firebase and Play
# release notes, falling back to "Build <n>" only when the key is unset.
# Ruby's "" is truthy, so exporting an empty string here would defeat that
# fallback outright whenever the allow_failure changelog job produced
# nothing, and testers would get a build with blank notes instead of the
# fallback label.
if [ -n "${CI_OUT_CHANGELOG_TEXT:-}" ]; then
  export RELEASE_NOTES="$CI_OUT_CHANGELOG_TEXT"
fi

if [ "${CI_UPLOADS_ENABLED:-false}" != "true" ]; then
  echo "pera-ci: uploads disabled; building the APK only"
  # A standard Expo prebuild project has no product flavors — see the
  # Fastfile's build_android, which passes only a build type. assembleRelease
  # is the only release task gradle actually defines.
  (cd apps/mobile/android && ./gradlew assembleRelease)
  collect_artifacts
  exit 0
fi

# deploy_internal/deploy_firebase both default options[:flavor] to "staging"
# when it isn't passed, and deploy_internal uses it to pick the Play package
# name (production -> com.algorand.android, anything else ->
# com.algorand.perarn.staging). Without this, a production upload would
# silently land on the staging Play listing instead of failing.
# Only needed on the upload path (gradlew alone doesn't touch fastlane), so
# installed here rather than unconditionally near the top of the job.
# Only this upload path runs fastlane, so only it needs the pinned Ruby.
use_pinned_ruby
(cd apps/mobile && bundle install)
(cd apps/mobile && bundle exec fastlane android "deploy_${DISTRIBUTION}" "flavor:$ENVIRONMENT")
collect_artifacts
