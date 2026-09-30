#!/usr/bin/env bash
set -uo pipefail

# Pins how ci/jobs/lib/ios-keychain.sh treats the user's default keychain.
# `security cms -D` imports a profile's embedded certificates into the default
# keychain and fails outright when there is none, which is the state of a job
# user that has never logged in. So setup makes the throwaway keychain the
# default, and teardown hands the previous one back.
#
# security, plutil and mktemp are shell functions standing in for the real
# tools: the helper is sourced, so they shadow the binaries, and the suite
# runs on the Linux CI image, which has neither of the first two.

LIB="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/ci/jobs/lib/ios-keychain.sh"
WORK=$(command mktemp -d)
trap 'rm -rf "$WORK"' EXIT

failures=0
check() { # $1 label  $2 expected  $3 actual
    if [ "$2" = "$3" ]; then
        echo "  ok    $1"
    else
        echo "  FAIL  $1: expected '$2', got '$3'"
        failures=$((failures + 1))
    fi
}

# GNU mktemp rejects the X-less `-t pera-signing` template macOS accepts.
mktemp() {
    if [ "${1:-}" = "-d" ]; then command mktemp -d "$WORK/tmp.XXXXXX"; else command mktemp "$@"; fi
}

plutil() {
    sed -n 's:.*<key>UUID</key><string>\(.*\)</string>.*:\1:p'
}

# State lives in files so the stub behaves the same inside the $(...)
# subshells the helper runs it in.
security() {
    echo "$*" >>"$STATE/calls"
    case "$1" in
    list-keychains)
        if [ "${4:-}" != "-s" ] && [ -f "$STATE/search" ]; then
            printf '    "%s"\n' "$(cat "$STATE/search")"
        fi
        ;;
    default-keychain)
        if [ "${4:-}" = "-s" ]; then
            printf '%s' "${5:-}" >"$STATE/default"
        elif [ -s "$STATE/default" ]; then
            printf '    "%s"\n' "$(cat "$STATE/default")"
        else
            echo "security: SecKeychainCopyDefault: A default keychain could not be found." >&2
            return 50
        fi
        ;;
    cms)
        if [ ! -s "$STATE/default" ]; then
            echo "security: cert import failed: A default keychain could not be found." >&2
            return 1
        fi
        if grep -q not-a-profile "$4"; then
            echo "security: problem decoding" >&2
            return 1
        fi
        echo '<plist><dict><key>UUID</key><string>test-uuid-1234</string></dict></plist>'
        ;;
    esac
    return 0
}

fresh_host() { # $1: the default keychain the user starts with, or empty for none
    STATE=$(command mktemp -d "$WORK/state.XXXXXX")
    HOME=$(command mktemp -d "$WORK/home.XXXXXX")
    echo "$HOME/Library/Keychains/login.keychain-db" >"$STATE/search"
    [ -n "$1" ] && printf '%s' "$1" >"$STATE/default"
    : >"$STATE/calls"
    # shellcheck source=/dev/null
    source "$LIB"
}

export IOS_CERTIFICATE_P12_BASE64 IOS_CERTIFICATE_PASSWORD=pw
IOS_CERTIFICATE_P12_BASE64=$(printf 'p12' | base64)
IOS_AUTOFILL_PROVISIONING_PROFILE_BASE64=""
PROFILE=$(printf 'a signed profile' | base64)

# A job user that has never logged in has no default keychain at all.
fresh_host ""
IOS_PROVISIONING_PROFILE_BASE64=$PROFILE
ios_keychain_setup >/dev/null 2>&1
check "setup succeeds for a user with no default keychain" 0 "$?"
check "the throwaway keychain is the default during the build" "$PERA_KEYCHAIN" "$(cat "$STATE/default" 2>/dev/null)"
installed="$HOME/Library/MobileDevice/Provisioning Profiles/test-uuid-1234.mobileprovision"
check "the profile is installed under its UUID" yes "$([ -f "$installed" ] && echo yes || echo no)"
ios_keychain_teardown
check "teardown removes the installed profile" no "$([ -f "$installed" ] && echo yes || echo no)"
check "teardown never sets an empty default" 0 "$(grep -cE '^default-keychain -d user -s ?$' "$STATE/calls")"

# A workstation or Bitrise runner has a login keychain, which must come back.
fresh_host "/Users/someone/Library/Keychains/login.keychain-db"
IOS_PROVISIONING_PROFILE_BASE64=$PROFILE
ios_keychain_setup >/dev/null 2>&1
check "setup succeeds for a user with a default keychain" 0 "$?"
ios_keychain_teardown
check "teardown restores the previous default" \
    "/Users/someone/Library/Keychains/login.keychain-db" "$(cat "$STATE/default")"

# The decoder's own error is the only clue to why a profile was rejected.
fresh_host "/Users/someone/Library/Keychains/login.keychain-db"
IOS_PROVISIONING_PROFILE_BASE64=$(printf 'not-a-profile' | base64)
err=$(ios_keychain_setup 2>&1 >/dev/null)
check "setup fails on a profile that does not decode" 1 "$?"
check "the decoder's error reaches the log" yes "$(grep -q 'problem decoding' <<<"$err" && echo yes || echo no)"
ios_keychain_teardown

if [ "$failures" -gt 0 ]; then
    echo "ios-keychain: ${failures} failure(s)"
    exit 1
fi
echo "ios-keychain: all checks passed"
