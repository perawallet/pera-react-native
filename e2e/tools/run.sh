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

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$E2E_DIR/results/$PLATFORM-$STAMP"
SNAPSHOT="$(mktemp -d)/e2e"

mkdir -p "$OUT"
# Everything the run reads, nothing it writes.
mkdir -p "$SNAPSHOT"
cp -R "$E2E_DIR/tests" "$E2E_DIR/resources" "$SNAPSHOT/"
find "$SNAPSHOT" -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true

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
  --outputdir "$OUT" "$SNAPSHOT/tests"
STATUS=$?
set -e
rm -rf "$(dirname "$SNAPSHOT")"
echo "$PLATFORM finished with status $STATUS; results in $OUT"
exit $STATUS
