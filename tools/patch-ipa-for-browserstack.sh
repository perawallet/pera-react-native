#!/usr/bin/env bash
# tools/patch-ipa-for-browserstack.sh
# Strips AppGroupIdentifier from an IPA's Info.plist so the app survives
# BrowserStack's re-signing.
#
# BrowserStack re-signs every uploaded IPA with its own profile, which drops the
# App Group entitlement. react-native-mmkv reads AppGroupIdentifier from
# Info.plist and roots its stores in that container (see
# apps/mobile/plugins/withExcludeDataFromBackup.js) — when the key is present but
# the entitlement is gone, MMKV raises a fatal error and the app hangs on the
# splash screen before any test can run. Removing the key makes MMKV fall back to
# the regular sandbox path.
#
# macOS only: needs PlistBuddy and codesign. Run on the build stack, not the
# Linux workflow that uploads the result.
set -euo pipefail

INPUT_IPA="${1:-}"
OUTPUT_IPA="${2:-${INPUT_IPA%.ipa}-browserstack.ipa}"

if [[ -z "$INPUT_IPA" ]]; then
  echo "Usage: $0 <input.ipa> [output.ipa]" >&2
  exit 1
fi

if [[ ! -f "$INPUT_IPA" ]]; then
  echo "Error: $INPUT_IPA not found" >&2
  exit 1
fi

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

unzip -q "$INPUT_IPA" -d "$WORK_DIR"

APP_PATH=$(find "$WORK_DIR/Payload" -maxdepth 1 -name "*.app" | head -1)
if [[ -z "$APP_PATH" ]]; then
  echo "Error: no .app found in $INPUT_IPA" >&2
  exit 1
fi

INFO_PLIST="$APP_PATH/Info.plist"

# Progress goes to stderr: stdout is the machine-readable output path, and a
# caller reading it must not have to filter chatter out of it.
if /usr/libexec/PlistBuddy -c "Print :AppGroupIdentifier" "$INFO_PLIST" &>/dev/null; then
  /usr/libexec/PlistBuddy -c "Delete :AppGroupIdentifier" "$INFO_PLIST"
  echo "Removed AppGroupIdentifier" >&2
else
  echo "AppGroupIdentifier absent — nothing to patch" >&2
fi

# Editing Info.plist invalidates the signature, so re-seal with the identity the
# archive already carries. BrowserStack re-signs again on upload; this only has
# to be well-formed enough to survive the trip.
ENTITLEMENTS_FILE="$WORK_DIR/entitlements.plist"
codesign -d --entitlements :- "$APP_PATH" 2>/dev/null >"$ENTITLEMENTS_FILE"

SIGN_IDENTITY=$(codesign -dvv "$APP_PATH" 2>&1 | awk -F= '/^Authority=/ {print $2; exit}')
if [[ -z "$SIGN_IDENTITY" ]]; then
  echo "Error: could not determine the signing identity of $APP_PATH" >&2
  exit 1
fi

codesign --force --sign "$SIGN_IDENTITY" --entitlements "$ENTITLEMENTS_FILE" "$APP_PATH"

OUTPUT_IPA_ABS=$([[ "$OUTPUT_IPA" = /* ]] && echo "$OUTPUT_IPA" || echo "$PWD/$OUTPUT_IPA")
rm -f "$OUTPUT_IPA_ABS"
(cd "$WORK_DIR" && zip -qr "$OUTPUT_IPA_ABS" Payload/)

echo "$OUTPUT_IPA_ABS"
