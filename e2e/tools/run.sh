#!/usr/bin/env bash
# Runs the suite from a snapshot, so editing it while a run is in flight cannot change
# what that run executes. Robot reads a resource file when its suite starts, so an edit
# halfway through a pass is picked up by the suites after it and not the ones before -
# which produces failures that belong to neither version of the file.
#
#   tools/run.sh android [robot args...]
#   tools/run.sh ios     [robot args...]
#
# SUITE=contacts runs one suite, and E2E_RESULTS_DIR puts the results somewhere you choose -
# which is how a flaky hunt runs every suite separately without a second runner that
# drifts away from this one.
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

# E2E_ONE_DEVICE=1 shuts the other platform down first. Both booted together is 1.7G of emulator
# plus a ~9G iOS simulator stack, which on a 24G machine leaves the host swapping and starves
# qemu's I/O thread until the emulator stops answering adb. It is opt-in because it also stops
# simulators and emulators that other work on the machine is using.
case "$PLATFORM" in
  android)
    if [ "${E2E_ONE_DEVICE:-0}" = 1 ]; then
      xcrun simctl shutdown all >/dev/null 2>&1 || true
      # The xcodebuild that hosts WebDriverAgent outlives the simulator and holds several GB.
      pkill -f "xcodebuild.*WebDriverAgent" >/dev/null 2>&1 || true
    fi
    if ! adb devices | grep -q "device$"; then
      echo "booting ${ANDROID_AVD:-Pixel_9}"
      nohup emulator -avd "${ANDROID_AVD:-Pixel_9}" -no-snapshot-save -no-boot-anim \
        > "$OUT/emulator.log" 2>&1 &
      for _ in $(seq 1 40); do
        [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
        sleep 10
      done
    fi
    # A Pixel image shows the keyboard's "Try out your stylus" education over the field a few
    # seconds after the keyboard opens. It is a full-screen InputMethod window, so Appium's dump
    # returns a hierarchy with nothing in it and every locator on that screen disappears
    # mid-test - which reads as the app blanking rather than as a system dialog.
    adb ${ANDROID_UDID:+-s "$ANDROID_UDID"} shell settings put secure stylus_handwriting_enabled 0 \
      >/dev/null 2>&1 || true
    ;;
  ios)
    [ "${E2E_ONE_DEVICE:-0}" = 1 ] && { adb emu kill >/dev/null 2>&1 || true; }
    if [ -n "${IOS_UDID:-}" ] && ! xcrun simctl list devices booted | grep -q "$IOS_UDID"; then
      echo "booting simulator $IOS_UDID"
      xcrun simctl boot "$IOS_UDID" >/dev/null 2>&1 || true
      sleep 15
    fi
    ;;
esac

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
  --outputdir "$OUT" "$SNAPSHOT/tests${SUITE:+/$SUITE.robot}"
STATUS=$?
set -e
echo "$PLATFORM finished with status $STATUS; results in $OUT"
exit $STATUS
