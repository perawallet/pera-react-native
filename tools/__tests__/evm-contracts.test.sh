#!/usr/bin/env bash
set -uo pipefail

# The fixture artifacts are only reproducible with the pinned compiler image,
# so the image pin and the forge invocation are what this guards. Docker is
# stubbed: it records how it was called and produces no build output.

DEV="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dev"
SCRIPT="$DEV/evm-contracts.sh"
WORK=$(mktemp -d)
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

export RECORD="$WORK/record"
mkdir -p "$WORK/bin"
cat >"$WORK/bin/docker" <<'STUB'
#!/usr/bin/env bash
[ "$1" = info ] && exit 0
printf 'docker %s\n' "$*" >>"$RECORD"
exit 0
STUB
chmod +x "$WORK/bin/docker"
export PATH="$WORK/bin:$PATH"

check "pins the foundry image by digest" "yes" \
    "$(grep -Eq 'FOUNDRY_IMAGE="ghcr.io/foundry-rs/foundry:v[0-9]+\.[0-9]+\.[0-9]+@sha256:[0-9a-f]{64}"' "$SCRIPT" && echo yes || echo no)"

: >"$RECORD"
bash "$SCRIPT" >/dev/null 2>&1
check "no command exits non-zero" "1" "$?"

: >"$RECORD"
bash "$SCRIPT" build >/dev/null 2>&1
check "build runs forge through the image entrypoint" "yes" \
    "$(grep -Eq -e '--entrypoint forge ghcr.io/foundry-rs/foundry:v[0-9.]+@sha256:[0-9a-f]{64} build' "$RECORD" && echo yes || echo no)"

if [ "$failures" -ne 0 ]; then
    echo "$failures failure(s)"
    exit 1
fi
