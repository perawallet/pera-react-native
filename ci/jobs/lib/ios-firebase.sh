#!/usr/bin/env bash
# Optional Firebase delivery alongside TestFlight. Sourced by ios.sh; never
# builds, uploads, or invites testers on its own.

ios_firebase_enabled() {
  [ "${FIREBASE_IOS_DISTRIBUTION:-false}" = true ] && [ "${CI_UPLOADS_ENABLED:-false}" = true ]
}

ios_firebase_validate() {
  local had_x=0 result=0 name missing=""
  case $- in *x*) had_x=1 ;; esac
  # This function checks secret values; never allow xtrace to echo them.
  set +x
  case "${FIREBASE_IOS_DISTRIBUTION:-false}" in
    false|'') ;;
    true)
      # Build-only runs need neither extra signing material nor upload access.
      if [ "${CI_UPLOADS_ENABLED:-false}" = true ]; then
        for name in FIREBASE_SERVICE_ACCOUNT_BASE64 IOS_FIREBASE_PROVISIONING_PROFILE_BASE64 IOS_FIREBASE_AUTOFILL_PROVISIONING_PROFILE_BASE64 IOS_FIREBASE_PROVISIONING_PROFILE_NAME IOS_FIREBASE_AUTOFILL_PROVISIONING_PROFILE_NAME; do
          [ -n "${!name:-}" ] || missing="$missing $name"
        done
        if [ -n "$missing" ]; then
          echo "pera-ci: iOS Firebase delivery requires:$missing. Supply ad-hoc profiles for the app and AutoFill extension; keep the TestFlight profiles unchanged." >&2
          result=1
        fi
      fi
      ;;
    *) echo "pera-ci: FIREBASE_IOS_DISTRIBUTION must be true or false" >&2; result=1 ;;
  esac
  if [ "$had_x" -eq 1 ]; then set -x; fi
  return "$result"
}

ios_firebase_prepare_credentials() {
  ios_firebase_enabled || return 0
  local had_x=0
  case $- in *x*) had_x=1 ;; esac
  set +x
  # The signing EXIT trap removes PERA_TMPDIR, including this decoded key.
  if [ -z "${PERA_TMPDIR:-}" ] || [ ! -d "$PERA_TMPDIR" ]; then
    echo "pera-ci: signing setup must run before Firebase credentials are prepared" >&2
    if [ "$had_x" -eq 1 ]; then set -x; fi
    return 1
  fi
  FIREBASE_IOS_SERVICE_CREDENTIALS_FILE="$PERA_TMPDIR/firebase-service-account.json"
  if ! (umask 077; printf '%s' "$FIREBASE_SERVICE_ACCOUNT_BASE64" | base64 --decode > "$FIREBASE_IOS_SERVICE_CREDENTIALS_FILE"); then
    echo "pera-ci: could not decode the Firebase service account" >&2
    if [ "$had_x" -eq 1 ]; then set -x; fi
    return 1
  fi
  export FIREBASE_IOS_SERVICE_CREDENTIALS_FILE
  if [ "$had_x" -eq 1 ]; then set -x; fi
}
