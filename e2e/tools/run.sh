#!/usr/bin/env bash
# Runs the suite from a snapshot, so editing it while a run is in flight cannot change
# what that run executes. Robot reads a resource file when its suite starts, so an edit
# halfway through a pass is picked up by the suites after it and not the ones before -
# which produces failures that belong to neither version of the file.
#
#   tools/run.sh android [robot args...]
#   tools/run.sh ios     [robot args...]
#
# Device selection comes from ANDROID_UDID / IOS_UDID, or pass --variable yourself.
set -euo pipefail

PLATFORM="${1:?usage: tools/run.sh <android|ios> [robot args...]}"
shift || true
case "$PLATFORM" in
  android | ios) ;;
  *) echo "unknown platform: $PLATFORM" >&2; exit 2 ;;
esac

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$E2E_DIR/results"
OUT="${E2E_RESULTS_DIR:-$(mktemp -d "$E2E_DIR/results/$PLATFORM-$(date +%Y%m%d-%H%M%S)-XXXXXX")}"
PYTHON="${E2E_VENV:-$E2E_DIR/.venv}/bin/python"

mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
[ -z "$(ls -A "$OUT")" ] || { echo "Results directory must be empty: $OUT" >&2; exit 2; }
SNAPSHOT="$OUT/suite-snapshot"
# Everything the run reads, nothing it writes.
mkdir -p "$SNAPSHOT"
cp -R "$E2E_DIR/tests" "$E2E_DIR/resources" "$SNAPSHOT/"
find "$SNAPSHOT" -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true

# A run killed mid-way leaves its UiAutomator2 server or WebDriverAgent holding the adapter's
# default port, and the next run then fails every suite's setup with "port busy". Take a free
# port unless one was chosen on purpose.
free_port() {
  "$PYTHON" -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()'
}

DEVICE=()
[ -z "${APPIUM_URL:-}" ] || DEVICE+=(--variable "APPIUM_URL:$APPIUM_URL")
case "$PLATFORM" in
  android)
    [ -n "${ANDROID_UDID:-}" ] && DEVICE+=(--variable "ANDROID_UDID:$ANDROID_UDID")
    DEVICE+=(--variable "ANDROID_SYSTEM_PORT:${ANDROID_SYSTEM_PORT:-$(free_port)}")
    for name in ANDROID_PACKAGE ANDROID_ACTIVITY; do
      [ -z "${!name:-}" ] || DEVICE+=(--variable "$name:${!name}")
    done
    ;;
  ios)
    [ -n "${IOS_UDID:-}" ] && DEVICE+=(--variable "IOS_UDID:$IOS_UDID")
    DEVICE+=(--variable "IOS_WDA_PORT:${IOS_WDA_PORT:-$(free_port)}")
    for name in IOS_BUNDLE_ID IOS_DEV_CLIENT_URL; do
      [ -z "${!name:-}" ] || DEVICE+=(--variable "$name:${!name}")
    done
    ;;
esac

echo "running $PLATFORM from snapshot $SNAPSHOT -> $OUT"
set +e
"$PYTHON" -m robot \
  --exclude slow --exclude needs-funded \
  --variable "E2E_TEST_TIMEOUT:${E2E_TEST_TIMEOUT:-5 minutes}" \
  --variable "PLATFORM:$PLATFORM" "${DEVICE[@]}" "$@" \
  --outputdir "$OUT" "$SNAPSHOT/tests"
STATUS=$?
set -e
echo "$PLATFORM finished with status $STATUS; results in $OUT"
exit $STATUS
