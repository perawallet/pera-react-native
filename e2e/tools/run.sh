#!/usr/bin/env bash
# Runs the suite from a snapshot, so editing it while a run is in flight cannot change
# what that run executes. Robot reads a resource file when its suite starts, so an edit
# halfway through a pass is picked up by the suites after it and not the ones before -
# which produces failures that belong to neither version of the file.
#
#   tools/run.sh android [robot args...]
#   tools/run.sh ios     [robot args...]
#
# SUITE=contacts runs one suite, and OUT_DIR puts the results somewhere you choose -
# which is how a flaky hunt runs every suite separately without a second runner that
# drifts away from this one. A hunt that skipped this script also skipped its
# one-device-at-a-time rule, and the pass died of the memory that costs.
#
# Device selection comes from ANDROID_UDID / IOS_UDID, or pass --variable yourself.
set -euo pipefail

PLATFORM="${1:?usage: tools/run.sh <android|ios> [robot args...]}"
shift || true

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${OUT_DIR:-$E2E_DIR/results/$PLATFORM-$STAMP}"
SNAPSHOT="$(mktemp -d)/e2e"

mkdir -p "$OUT"
# Everything the run reads, nothing it writes.
mkdir -p "$SNAPSHOT"
cp -R "$E2E_DIR/tests" "$E2E_DIR/resources" "$SNAPSHOT/"
find "$SNAPSHOT" -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true

# One device at a time. Both booted together is 1.7G of emulator plus a ~9G iOS simulator
# stack on a 24G machine, which leaves the host swapping and starves qemu's I/O thread:
# the emulator stops answering adb and the run dies halfway with nothing to show for it.
# So shut the other platform down, and bring this one up if it is not already there.
case "$PLATFORM" in
  android)
    xcrun simctl shutdown all >/dev/null 2>&1 || true
    # Shutting the simulator down is not enough: the xcodebuild that hosts
    # WebDriverAgent outlives it and was still holding 6.3G, which is most of what
    # the next Android pass needed. It is rebuilt on the next iOS run.
    pkill -f "xcodebuild.*WebDriverAgent" >/dev/null 2>&1 || true
    if ! adb devices | grep -q "device$"; then
      echo "booting ${ANDROID_AVD:-Pixel_9}"
      nohup emulator -avd "${ANDROID_AVD:-Pixel_9}" -no-snapshot-save -no-boot-anim \
        > "$OUT/emulator.log" 2>&1 &
      for _ in $(seq 1 40); do
        [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
        sleep 10
      done
    fi
    ;;
  ios)
    adb emu kill >/dev/null 2>&1 || true
    if [ -n "${IOS_UDID:-}" ] && ! xcrun simctl list devices booted | grep -q "$IOS_UDID"; then
      echo "booting simulator $IOS_UDID"
      xcrun simctl boot "$IOS_UDID" >/dev/null 2>&1 || true
      sleep 15
    fi
    ;;
esac

DEVICE=()
case "$PLATFORM" in
  android) [ -n "${ANDROID_UDID:-}" ] && DEVICE=(--variable "ANDROID_UDID:$ANDROID_UDID") ;;
  ios)     [ -n "${IOS_UDID:-}" ]     && DEVICE=(--variable "IOS_UDID:$IOS_UDID") ;;
  *) echo "unknown platform: $PLATFORM" >&2; exit 2 ;;
esac

echo "running $PLATFORM from snapshot $SNAPSHOT -> $OUT"
set +e
"$E2E_DIR/.venv/bin/python" -m robot \
  --exclude slow --exclude needs-funded \
  --variable "PLATFORM:$PLATFORM" "${DEVICE[@]}" "$@" \
  --outputdir "$OUT" "$SNAPSHOT/tests${SUITE:+/$SUITE.robot}"
STATUS=$?
set -e
rm -rf "$(dirname "$SNAPSHOT")"
echo "$PLATFORM finished with status $STATUS; results in $OUT"
exit $STATUS
