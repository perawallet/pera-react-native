#!/usr/bin/env bash
# set -e without -x: the loop below expands secret values, and -x would print
# them into the build log. Progress is logged by name via echo instead.
set -e

# Sets up environment-specific secrets for Bitrise builds.
# Aliases prefixed secret vars (PRODUCTION_* or STAGING_*) to unprefixed names
# using envman, so downstream steps can reference them generically.
#
# Required env vars:
#   ENVIRONMENT - "production" or "staging"
#
# Optional env vars (per-environment, prefixed with PRODUCTION_ or STAGING_):
#   MAINNET_BACKEND_URL, TESTNET_BACKEND_URL, BACKEND_API_KEY,
#   IOS_GOOGLE_SERVICE_INFO_BASE64, IOS_PROVISIONING_PROFILE_NAME,
#   IOS_AUTOFILL_PROVISIONING_PROFILE_NAME, FIREBASE_APP_ID_ANDROID,
#   APP_STORE_APPLE_ID, PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER,
#   TESTNET_BAANX_CLIENT_KEY
#
# Web (browser extension) only — Firebase Web SDK / GA4 / Sentry, see
# extensions/platform-chrome/src/services/{firebase-app,analytics,
# crash-reporting}.ts. Unused by the RN mobile builds.
#   FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_DATABASE_URL,
#   FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID,
#   FIREBASE_APP_ID, FIREBASE_MEASUREMENT_ID, FIREBASE_VAPID_KEY,
#   GA_MEASUREMENT_API_SECRET, SENTRY_DSN

echo "Setting up secrets for environment: $ENVIRONMENT"

if [ "$ENVIRONMENT" == "production" ]; then
  PREFIX="PRODUCTION_"
else
  PREFIX="STAGING_"
fi

# List of secrets to alias
SECRETS=(
  "MAINNET_BACKEND_URL"
  "TESTNET_BACKEND_URL"
  "BACKEND_API_KEY"
  "IOS_GOOGLE_SERVICE_INFO_BASE64"
  "ANDROID_GOOGLE_SERVICES_BASE64"
  "IOS_PROVISIONING_PROFILE_NAME"
  "IOS_AUTOFILL_PROVISIONING_PROFILE_NAME"
  "FIREBASE_APP_ID_ANDROID"
  "APP_STORE_APPLE_ID"
  "PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER"
  "TESTNET_BAANX_CLIENT_KEY"
  "FIREBASE_API_KEY"
  "FIREBASE_AUTH_DOMAIN"
  "FIREBASE_DATABASE_URL"
  "FIREBASE_PROJECT_ID"
  "FIREBASE_STORAGE_BUCKET"
  "FIREBASE_MESSAGING_SENDER_ID"
  "FIREBASE_APP_ID"
  "FIREBASE_MEASUREMENT_ID"
  # Web Push certificate public key. Per-environment like the rest of the
  # Firebase config because the key belongs to one Firebase project — pairing
  # a key with a different FIREBASE_PROJECT_ID makes Chrome's push service
  # reject the subscription, so no token is ever minted.
  "FIREBASE_VAPID_KEY"
  "GA_MEASUREMENT_API_SECRET"
  "SENTRY_DSN"
)

for SECRET in "${SECRETS[@]}"; do
  SOURCE_VAR="${PREFIX}${SECRET}"
  # Use indirect expansion to get the value of the source variable
  VALUE="${!SOURCE_VAR}"

  if [ -n "$VALUE" ]; then
    echo "Aliasing $SOURCE_VAR to $SECRET"
    envman add --key "$SECRET" --value "$VALUE" --sensitive
  else
    echo "Warning: $SOURCE_VAR is not set or empty"
  fi
done

# IOS_TEAM_ID is expected to be a global secret, available as env var
if [ -z "$IOS_TEAM_ID" ]; then
  echo "Warning: IOS_TEAM_ID is not set"
fi
