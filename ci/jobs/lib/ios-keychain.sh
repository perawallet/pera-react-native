#!/usr/bin/env bash
# Sourced by an iOS job. Creates a throwaway keychain, imports the signing
# certificate and installs the provisioning profiles; the teardown removes
# every trace whether the build passed or failed.
#
# Expects in the environment:
#   IOS_CERTIFICATE_P12_BASE64, IOS_CERTIFICATE_PASSWORD
#   IOS_PROVISIONING_PROFILE_BASE64, IOS_AUTOFILL_PROVISIONING_PROFILE_BASE64

PERA_KEYCHAIN=""
PERA_TMPDIR=""
PERA_OLD_KEYCHAINS=()
PERA_INSTALLED_PROFILES=()

ios_keychain_teardown() {
  local had_x=0
  case $- in *x*) had_x=1 ;; esac
  set +x
  if [ -n "$PERA_KEYCHAIN" ]; then
    # Put the search list back before touching the keychain file: this way
    # the restore never depends on whether delete-keychain also edits the
    # search list itself (undocumented, not something to rely on), and it
    # never references a path that might already be gone.
    # Only when we actually captured a list: `-s` with no arguments empties
    # the user search list, so a failed capture would cost the operator their
    # own login keychain rather than just this run.
    if [ ${#PERA_OLD_KEYCHAINS[@]} -gt 0 ]; then
      security list-keychains -d user -s "${PERA_OLD_KEYCHAINS[@]}"
    fi
    # No -f guard here: if create-keychain ever wrote somewhere other than
    # $PERA_KEYCHAIN, a guard on that path would turn a leaked keychain into a
    # silent no-op. delete-keychain already tolerates the never-created case.
    security delete-keychain "$PERA_KEYCHAIN" 2>/dev/null || true
  fi
  if [ -n "$PERA_TMPDIR" ]; then
    rm -rf "$PERA_TMPDIR"
  fi
  local profile
  for profile in ${PERA_INSTALLED_PROFILES[@]+"${PERA_INSTALLED_PROFILES[@]}"}; do
    [ -n "$profile" ] && rm -f "$profile"
  done
  PERA_KEYCHAIN=""
  PERA_TMPDIR=""
  PERA_OLD_KEYCHAINS=()
  PERA_INSTALLED_PROFILES=()
  if [ "$had_x" -eq 1 ]; then set -x; fi
}

_install_profile() {
  local b64="$1" tmp uuid
  [ -n "$b64" ] || return 0
  tmp=$(mktemp "$PERA_TMPDIR/profile.XXXXXX")
  printf '%s' "$b64" | base64 --decode > "$tmp"
  # The profile is a CMS envelope; the UUID inside is the filename Xcode looks
  # for. Installing under any other name means codesign cannot find it.
  if ! uuid=$(security cms -D -i "$tmp" 2>/dev/null | plutil -extract UUID raw - 2>/dev/null) || [ -z "$uuid" ]; then
    rm -f "$tmp"
    echo "pera-ci: failed to decode provisioning profile" >&2
    return 1
  fi
  local dest="$HOME/Library/MobileDevice/Provisioning Profiles/${uuid}.mobileprovision"
  mkdir -p "$(dirname "$dest")"
  mv "$tmp" "$dest"
  PERA_INSTALLED_PROFILES+=("$dest")
  echo "pera-ci: installed provisioning profile ${uuid}"
}

ios_keychain_setup() {
  local had_x=0
  case $- in *x*) had_x=1 ;; esac
  # Tracing off for the whole function: every line here handles key material.
  set +x
  local kc_pass p12 import_rc line
  # A dedicated temp dir, not loose mktemp files: teardown removes it with a
  # single rm -rf, so every decoded secret in it is covered by the EXIT trap
  # even on a mid-setup failure, not just the paths cleaned up explicitly below.
  PERA_TMPDIR=$(mktemp -d -t pera-signing)
  PERA_KEYCHAIN="$HOME/Library/Keychains/pera-ci-$$.keychain-db"

  # Captured before the keychain exists or the search list changes, so a
  # failure in any later step still leaves teardown with the right list to
  # restore.
  PERA_OLD_KEYCHAINS=()
  while IFS= read -r line; do
    [ -n "$line" ] && PERA_OLD_KEYCHAINS+=("$line")
  done < <(security list-keychains -d user | tr -d '"' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

  kc_pass=$(openssl rand -base64 24)
  security create-keychain -p "$kc_pass" "$PERA_KEYCHAIN"
  # No auto-lock: a keychain that relocks mid-archive fails the build.
  security set-keychain-settings -lut 21600 "$PERA_KEYCHAIN"
  security unlock-keychain -p "$kc_pass" "$PERA_KEYCHAIN"
  # Must join the search list or codesign will not look in it. Read as an
  # array rather than word-split from a bare $(...): an unquoted path with a
  # space (e.g. a login keychain under a two-word macOS username) would
  # otherwise split into two arguments here.
  security list-keychains -d user -s "$PERA_KEYCHAIN" ${PERA_OLD_KEYCHAINS[@]+"${PERA_OLD_KEYCHAINS[@]}"}

  p12="$PERA_TMPDIR/cert.p12"
  printf '%s' "$IOS_CERTIFICATE_P12_BASE64" | base64 --decode > "$p12"
  # -f pkcs12 is required: security import otherwise guesses format from the
  # file extension, and mktemp leaves none, so it fails with "Unknown
  # format in import" on every run.
  # -P puts the p12 password on the command line, visible to `ps` for the
  # instant this runs. security import has no stdin or env route for it.
  # Accepted: jobs run under their own dedicated user on a single-purpose
  # machine, so there's no other local user to read it.
  import_rc=0
  security import "$p12" -k "$PERA_KEYCHAIN" -f pkcs12 -P "$IOS_CERTIFICATE_PASSWORD" \
    -T /usr/bin/codesign -T /usr/bin/security || import_rc=$?
  # The decoded p12 is the private key in the clear: it must not survive
  # past the import, whether the import succeeded or not. PERA_TMPDIR's own
  # teardown would also catch it, but that's the backstop, not the plan —
  # the key has no business sitting on disk for the rest of the build.
  rm -f "$p12"
  if [ "$import_rc" -ne 0 ]; then
    echo "pera-ci: failed to import signing certificate" >&2
    if [ "$had_x" -eq 1 ]; then set -x; fi
    return "$import_rc"
  fi

  # Without this, codesign blocks on a GUI prompt that nobody can see on a
  # headless machine: the build hangs rather than failing.
  security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$kc_pass" "$PERA_KEYCHAIN" >/dev/null

  if ! _install_profile "${IOS_PROVISIONING_PROFILE_BASE64:-}"; then
    if [ "$had_x" -eq 1 ]; then set -x; fi
    return 1
  fi
  if ! _install_profile "${IOS_AUTOFILL_PROVISIONING_PROFILE_BASE64:-}"; then
    if [ "$had_x" -eq 1 ]; then set -x; fi
    return 1
  fi
  echo "pera-ci: signing keychain ready"
  if [ "$had_x" -eq 1 ]; then set -x; fi
}
