#!/usr/bin/env bash
set -euo pipefail

# tools/resolve-distribution.sh
# Single source of truth for the Android distribution channel (play | firebase).
# Echoes the resolved channel on stdout so both the bitrise "Resolve
# distribution channel" step and validate-env.sh agree without duplicating the
# tag-matching logic (which would drift).
#
# Both production AND staging publish to their respective Play Console internal
# tracks on an rc (-rc) or STABLE (vX.Y.Z) tag: deploy_internal uploads the AAB
# to Play — the package is ANDROID_PACKAGE_NAME (com.algorand.android for prod,
# com.algorand.perarn.staging for staging) — and an APK to Firebase. Nightly
# (-alpha) builds go to Firebase only. Non-tag builds keep the caller's
# DISTRIBUTION default.
#
# Inputs (env):
#   BITRISE_GIT_TAG   the release tag, when building from one
#   DISTRIBUTION      firebase | play   (fallback for non-tag builds)
#
# bash 3.2 safe: shared with the macOS iOS validate step.

dist="${DISTRIBUTION:-firebase}"
case "${BITRISE_GIT_TAG:-}" in
  *-alpha.*) dist="firebase" ;;
  *-rc.* | v*) dist="play" ;;
esac

printf '%s\n' "$dist"
