#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT/ci/jobs/lib/ios-firebase.sh"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

check() { if [ "$2" != "$3" ]; then echo "FAIL $1: expected $2, got $3" >&2; exit 1; fi; }
FIREBASE_IOS_DISTRIBUTION=false
CI_UPLOADS_ENABLED=true
ios_firebase_validate
check 'default delivery is disabled' no "$(ios_firebase_enabled && echo yes || echo no)"
FIREBASE_IOS_DISTRIBUTION=true
CI_UPLOADS_ENABLED=false
ios_firebase_validate
check 'build-only runs cannot upload' no "$(ios_firebase_enabled && echo yes || echo no)"
CI_UPLOADS_ENABLED=true
if ios_firebase_validate >"$WORK/error" 2>&1; then echo 'missing profiles were accepted' >&2; exit 1; fi
for name in IOS_FIREBASE_PROVISIONING_PROFILE_BASE64 IOS_FIREBASE_AUTOFILL_PROVISIONING_PROFILE_NAME; do
  grep -q "$name" "$WORK/error"
done
FIREBASE_SERVICE_ACCOUNT_BASE64=$(printf '{"private_key":"test-only-canary"}' | base64)
export IOS_FIREBASE_PROVISIONING_PROFILE_BASE64=profile-canary
export IOS_FIREBASE_AUTOFILL_PROVISIONING_PROFILE_BASE64=extension-canary
export IOS_FIREBASE_PROVISIONING_PROFILE_NAME='QA App'
export IOS_FIREBASE_AUTOFILL_PROVISIONING_PROFILE_NAME='QA AutoFill'
(set -x; ios_firebase_validate) >"$WORK/trace" 2>&1
if grep -qE 'profile-canary|extension-canary|test-only-canary' "$WORK/trace"; then echo 'validation leaked secret contents' >&2; exit 1; fi
check 'configured delivery is enabled' yes "$(ios_firebase_enabled && echo yes || echo no)"
PERA_TMPDIR="$WORK/signing"
mkdir -m 0700 "$PERA_TMPDIR"
ios_firebase_prepare_credentials
check 'credential content is decoded' '{"private_key":"test-only-canary"}' "$(cat "$FIREBASE_IOS_SERVICE_CREDENTIALS_FILE")"
mode=$(stat -f '%Lp' "$FIREBASE_IOS_SERVICE_CREDENTIALS_FILE" 2>/dev/null || stat -c '%a' "$FIREBASE_IOS_SERVICE_CREDENTIALS_FILE")
check 'decoded credentials are private' 600 "$mode"
FIREBASE_IOS_DISTRIBUTION=unexpected
if ios_firebase_validate >"$WORK/error" 2>&1; then echo 'invalid flag was accepted' >&2; exit 1; fi
printf '%s\n' 'ios-firebase: all checks passed'
