#!/usr/bin/env bash
# Preview the exact default cloud selection and job layout without credentials or devices.
set -euo pipefail
PLATFORM="${1:?usage: tools/plan.sh <android|ios> [robot filter args...]}"
shift
case "$PLATFORM" in android | ios) ;; *) echo "unknown platform: $PLATFORM" >&2; exit 2 ;; esac
E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${E2E_VENV:-$E2E_DIR/.venv}/bin/python"
mkdir -p "$E2E_DIR/results"
OUT=$(mktemp -d "$E2E_DIR/results/plan-$PLATFORM-XXXXXX")
"$PYTHON" "$E2E_DIR/tools/selected_suites.py" --manifest "$OUT/selection.json" \
  --exclude slow --exclude needs-funded --exclude excludefromci --exclude device-shell \
  "$@" "$E2E_DIR"/tests/*.robot >"$OUT/suites.txt"
ARGS=()
case "${E2E_SESSION_REUSE:-0}" in
  1) ARGS+=(--reuse) ;;
  0) ;;
  *) echo "E2E_SESSION_REUSE must be 0 or 1" >&2; exit 2 ;;
esac
"$PYTHON" "$E2E_DIR/tools/schedule.py" plan "$OUT/selection.json" \
  --history "${E2E_TIMINGS_FILE:-$E2E_DIR/.cache/timings-$PLATFORM.json}" \
  --context "$PLATFORM|${E2E_DEVICE:-default}" --workers "${E2E_PARALLEL:-1}" \
  --budget "${E2E_JOB_SECONDS:-900}" --output "$OUT/plan.json" ${ARGS[@]+"${ARGS[@]}"} >"$OUT/jobs.txt"
"$PYTHON" "$E2E_DIR/tools/schedule.py" show "$OUT/plan.json"
echo "Plan saved in $OUT"
