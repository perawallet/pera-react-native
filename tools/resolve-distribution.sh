#!/usr/bin/env bash
set -euo pipefail

# tools/resolve-distribution.sh
# Single source of truth for the Android distribution channel (play | firebase).
# Echoes the resolved channel on stdout so both the bitrise "Resolve
# distribution channel" step and validate-env.sh agree without duplicating the
# tag-matching logic (which would drift).
#
# Production publishes to the Play Console (internal track) on an rc (-rc) or
# STABLE (vX.Y.Z) tag — deploy_internal uploads the AAB to Play and an APK to
# Firebase. Nightly (-alpha) builds, plus all staging builds, go to Firebase
# only. Non-production / non-tag builds keep the caller's DISTRIBUTION default.
#
# Inputs (env):
#   ENVIRONMENT       staging | production
#   BITRISE_GIT_TAG   the release tag, when building from one
#   DISTRIBUTION      firebase | play   (fallback for non-production/non-tag)
#
# bash 3.2 safe: shared with the macOS iOS validate step.

dist="${DISTRIBUTION:-firebase}"
if [ "${ENVIRONMENT:-}" = "production" ]; then
  case "${BITRISE_GIT_TAG:-}" in
    *-alpha.*) dist="firebase" ;;
    *-rc.* | v*) dist="play" ;;
  esac
fi

printf '%s\n' "$dist"
