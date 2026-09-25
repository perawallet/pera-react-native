#!/usr/bin/env bash
set -euxo pipefail

# bitrise.yml's _smoke-ios / _smoke-android: the staging build's own artifact,
# which bakes DISABLE_SCREEN_CAPTURE_PREVENTION, run through the BrowserStack
# release gate. The IPA was already patched by ios.sh, the only job that holds
# the signing identity the patch re-signs with.
source ci/jobs/lib/toolchain.sh

case "$SMOKE_PLATFORM" in
  ios) ARTIFACT="${CI_OUT_IOS_STAGING_SMOKE_IPA:-}" ;;
  android) ARTIFACT="$CI_ARTIFACT_DIR/app_build_outputs_apk_release_app-release.apk" ;;
esac

APP_VERSION=$(resolve_app_version)
export APP_VERSION
# In the artifact dir so the Robot report outlives the run; it matters most
# when the gate is red.
export SMOKE_RESULTS_DIR="$CI_ARTIFACT_DIR/smoke-results-$SMOKE_PLATFORM"
./tools/smoke-test.sh "$SMOKE_PLATFORM" "$ARTIFACT"
