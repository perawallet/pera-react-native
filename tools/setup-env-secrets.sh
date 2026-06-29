#!/usr/bin/env bash
set -ex

# Sets up environment-specific secrets for Bitrise builds.
# Aliases prefixed secret vars (PRODUCTION_* or STAGING_*) to unprefixed names
# using envman, so downstream steps can reference them generically.
#
# Required env vars:
#   ENVIRONMENT - "production" or "staging"
#
# Optional env vars (per-environment, prefixed with PRODUCTION_ or STAGING_):
#   MAINNET_BACKEND_URL, TESTNET_BACKEND_URL, BACKEND_API_KEY,
#   ALGOD_API_KEY, INDEXER_API_KEY,
#   IOS_GOOGLE_SERVICE_INFO_BASE64, DISCOVER_BASE_URL, STAKING_BASE_URL,
#   ONRAMP_BASE_URL, IOS_PROVISIONING_PROFILE_NAME,
#   IOS_AUTOFILL_PROVISIONING_PROFILE_NAME, FIREBASE_APP_ID_ANDROID,
#   APP_STORE_APPLE_ID, PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER,
#   MAINNET_BIDALI_API_KEY, TESTNET_BIDALI_API_KEY,
#   MAINNET_BAANX_CLIENT_KEY, TESTNET_BAANX_CLIENT_KEY, MAINNET_BAANX_TENANT_ID

echo "Setting up secrets for environment: $ENVIRONMENT"

if [ "$ENVIRONMENT" == "production" ]; then
  PREFIX="PRODUCTION_"
else
  PREFIX="STAGING_"
fi

# List of secrets to alias. Must cover every productionConfig field that
# defaults to '' (i.e. has no usable OSS default and must be injected) — see
# packages/config/src/main.ts and its overrideEnvironmentMap. A secret set in
# Bitrise but missing here is silently dropped: the build falls back to the
# empty default.
SECRETS=(
  "MAINNET_BACKEND_URL"
  "TESTNET_BACKEND_URL"
  "BACKEND_API_KEY"
  "ALGOD_API_KEY"
  "INDEXER_API_KEY"
  "IOS_GOOGLE_SERVICE_INFO_BASE64"
  "ANDROID_GOOGLE_SERVICES_BASE64"
  "DISCOVER_BASE_URL"
  "STAKING_BASE_URL"
  "ONRAMP_BASE_URL"
  "IOS_PROVISIONING_PROFILE_NAME"
  "IOS_AUTOFILL_PROVISIONING_PROFILE_NAME"
  "FIREBASE_APP_ID_ANDROID"
  "APP_STORE_APPLE_ID"
  "PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER"
  "MAINNET_BIDALI_API_KEY"
  "TESTNET_BIDALI_API_KEY"
  "MAINNET_BAANX_CLIENT_KEY"
  "TESTNET_BAANX_CLIENT_KEY"
  "MAINNET_BAANX_TENANT_ID"
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
