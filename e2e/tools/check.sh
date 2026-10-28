#!/usr/bin/env bash
# Device-free checks shared by local development and pre-merge CI.
set -euo pipefail
E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${E2E_VENV:-$E2E_DIR/.venv}/bin/python"
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT
"$PYTHON" -m pytest "$E2E_DIR/tools" -q
for platform in android ios; do
  "$PYTHON" -m robot --dryrun --variable "PLATFORM:$platform" \
    --console quiet --log NONE --report NONE --outputdir "$OUT/$platform" "$E2E_DIR/tests"
  echo "$platform dry run passed"
done
