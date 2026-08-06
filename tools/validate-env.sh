#!/usr/bin/env bash
set -euo pipefail

# tools/validate-env.sh
# Fails fast when a required Bitrise env var / secret for the current workflow
# is missing, BEFORE expensive build steps run. Pure precondition check: reads
# env, reports, exits. Never mutates env, never prints secret values.
#
# Inputs (env):
#   VALIDATE_PROFILE  check-changes | test | ios | android | create-nightly-tag   (required)
#   ENVIRONMENT       staging | production   (selects secret prefix)
#   DISTRIBUTION      firebase | play        (android distribution credential)
#
# Per-env secrets are configured in Bitrise under a STAGING_/PRODUCTION_ prefix
# and aliased to unprefixed names at build time by setup-env-secrets.sh. This
# script validates the PREFIXED source names so it can run before aliasing.
#
# bash 3.2 safe: the iOS build runs on macOS whose /bin/bash is 3.2.

PROFILE="${VALIDATE_PROFILE:-}"
if [ -z "$PROFILE" ]; then
  echo "ERROR: VALIDATE_PROFILE is not set" >&2
  exit 1
fi

if [ "${ENVIRONMENT:-}" = "production" ]; then
  PREFIX="PRODUCTION_"
else
  PREFIX="STAGING_"
fi

# Vars validated by their literal (global / unprefixed) name.
required_global=()
# Vars validated by their prefixed source name (${PREFIX}NAME).
required_prefixed=()
# Optional vars: warn if missing, never fail.
optional_global=()
optional_prefixed=()

case "$PROFILE" in
  check-changes)
    # Without BITRISE_API_TOKEN the workflow still completes (it falls back to
    # HAS_CHANGES=true), so the token is optional, not required.
    optional_global+=( "BITRISE_API_TOKEN" )
    ;;
  test)
    : # runs `pnpm test` only — no secrets required
    ;;
  create-nightly-tag)
    : # SSH-origin push uses the Bitrise app key; no secrets to validate here
    ;;
  ios)
    required_global+=(
      "APP_STORE_CONNECT_API_KEY_CONTENT"
      "APP_STORE_CONNECT_API_KEY_ISSUER_ID"
      "APP_STORE_CONNECT_API_KEY_KEY_ID"
      "IOS_TEAM_ID"
      "SLACK_WEBHOOK_URL"
    )
    required_prefixed+=(
      "IOS_GOOGLE_SERVICE_INFO_BASE64"
      "IOS_PROVISIONING_PROFILE_NAME"
      "IOS_AUTOFILL_PROVISIONING_PROFILE_NAME"
      "MAINNET_BACKEND_URL"
      "TESTNET_BACKEND_URL"
      "BACKEND_API_KEY"
    )
    optional_prefixed+=(
      "TESTNET_BAANX_CLIENT_KEY"
    )
    ;;
  android)
    required_global+=(
      "ANDROID_KEYSTORE_BASE64"
      "SLACK_WEBHOOK_URL"
    )
    required_prefixed+=(
      "ANDROID_GOOGLE_SERVICES_BASE64"
      "FIREBASE_APP_ID_ANDROID"
      "MAINNET_BACKEND_URL"
      "TESTNET_BACKEND_URL"
      "BACKEND_API_KEY"
    )
    # deploy_firebase needs only the Firebase service account. deploy_internal
    # (play: rc/stable) uploads the AAB to Play AND an APK to Firebase, so it
    # needs both. Resolve the effective channel here — validation can run before
    # the bitrise "Resolve distribution channel" step, so a play build must fail
    # fast on a missing Play key rather than after the Play upload succeeds.
    required_global+=( "FIREBASE_SERVICE_ACCOUNT_BASE64" )
    if [ "$("$(dirname "${BASH_SOURCE[0]}")/resolve-distribution.sh")" = "play" ]; then
      required_global+=( "ANDROID_JSON_KEY_FILE" )
    fi
    optional_prefixed+=(
      "TESTNET_BAANX_CLIENT_KEY"
    )
    ;;
  web)
    # Zip-only build (no store/CWS upload yet), so no signing/upload
    # credentials are required — just the same backend wiring as ios/android.
    required_global+=(
      "SLACK_WEBHOOK_URL"
    )
    required_prefixed+=(
      "MAINNET_BACKEND_URL"
      "TESTNET_BACKEND_URL"
      "BACKEND_API_KEY"
    )
    # Firebase Web SDK / GA4 / Sentry are extension-only features that
    # degrade gracefully when unset (see extensions/platform-chrome/src/
    # services/firebase-app.ts) — optional here, but effectively required for
    # Remote Config, analytics, and crash reporting to work in staging/prod.
    optional_prefixed+=(
      "DISCOVER_BASE_URL" "STAKING_BASE_URL" "ONRAMP_BASE_URL" "TESTNET_BAANX_CLIENT_KEY"
      "FIREBASE_API_KEY" "FIREBASE_AUTH_DOMAIN" "FIREBASE_DATABASE_URL"
      "FIREBASE_PROJECT_ID" "FIREBASE_STORAGE_BUCKET" "FIREBASE_MESSAGING_SENDER_ID"
      "FIREBASE_APP_ID" "FIREBASE_MEASUREMENT_ID" "GA_MEASUREMENT_API_SECRET"
      "SENTRY_DSN"
    )
    ;;
  *)
    echo "ERROR: unknown VALIDATE_PROFILE '$PROFILE'" >&2
    exit 1
    ;;
esac

# The smoke gate runs at the end of the staging workflows and only reaches
# BrowserStack after a full native build and a store upload. Validate here so a
# missing credential costs seconds rather than a finished archive.
if [ "${RUN_SMOKE:-}" = "true" ]; then
  required_global+=(
    "BROWSERSTACK_USERNAME"
    "BROWSERSTACK_ACCESS_KEY"
    "SMOKE_HARNESS_GITHUB_TOKEN"
  )
fi

missing=()

is_set() {
  # indirect expansion, bash 3.2 safe; empty/unset both count as missing
  [ -n "${!1:-}" ]
}

for v in ${required_global[@]+"${required_global[@]}"}; do
  is_set "$v" || missing+=( "$v" )
done
for v in ${required_prefixed[@]+"${required_prefixed[@]}"}; do
  is_set "${PREFIX}${v}" || missing+=( "${PREFIX}${v}" )
done
for v in ${optional_global[@]+"${optional_global[@]}"}; do
  is_set "$v" || echo "WARNING: optional var $v is not set"
done
for v in ${optional_prefixed[@]+"${optional_prefixed[@]}"}; do
  is_set "${PREFIX}${v}" || echo "WARNING: optional var ${PREFIX}${v} is not set"
done

if [ ${#missing[@]} -gt 0 ]; then
  echo "ERROR: missing required env vars/secrets for profile '$PROFILE' (env=${ENVIRONMENT:-staging}):" >&2
  for v in ${missing[@]+"${missing[@]}"}; do
    echo "  - $v" >&2
  done
  exit 1
fi

echo "✓ env validation passed for profile '$PROFILE' (env=${ENVIRONMENT:-staging})"
