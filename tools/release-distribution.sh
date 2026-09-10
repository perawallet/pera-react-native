#!/usr/bin/env bash
set -euo pipefail

# tools/release-distribution.sh
# Single source of truth for the Android distribution channel (play | firebase).
# Echoes the resolved channel on stdout so both the bitrise "Resolve
# distribution channel" step and dev-env-validate.sh agree without duplicating the
# tag-matching logic (which would drift).
#
# Production publishes to the Play Console internal track on an rc (-rc) or
# STABLE (vX.Y.Z) tag: deploy_internal uploads the AAB to Play
# (ANDROID_PACKAGE_NAME) and an APK to Firebase. Nightly (-alpha) builds go to
# Firebase only. Staging never publishes to Play — Firebase App Distribution is
# its only channel, whatever the tag. Non-tag builds keep the caller's
# DISTRIBUTION default.
#
# Inputs (env):
#   BITRISE_GIT_TAG   the release tag, when building from one
#   DISTRIBUTION      firebase | play   (fallback for non-tag builds)
#   ENVIRONMENT       staging | production
#
# bash 3.2 safe: shared with the macOS iOS validate step.

dist="${DISTRIBUTION:-firebase}"
if [ "${ENVIRONMENT:-}" != "staging" ]; then
  case "${BITRISE_GIT_TAG:-}" in
    *-alpha.*) dist="firebase" ;;
    *-rc.* | v*) dist="play" ;;
  esac
fi

printf '%s\n' "$dist"
