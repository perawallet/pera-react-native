#!/usr/bin/env bash
set -uo pipefail

# The capture talks to a public RPC through the pinned Foundry image, so Docker
# is stubbed: it records its arguments and prints the lines the in-container
# capture would. What this guards is argument validation and the fixture the
# script writes from those lines.

DEV="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dev"
SCRIPT="$DEV/capture-op-predeploys.sh"
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
export CAPTURE_OUTPUT="$WORK/capture-output"
mkdir -p "$WORK/bin"
cat >"$WORK/bin/docker" <<'STUB'
#!/usr/bin/env bash
[ "$1" = info ] && exit 0
printf 'docker %s\n' "$*" >>"$RECORD"
cat "$CAPTURE_OUTPUT"
STUB
chmod +x "$WORK/bin/docker"
export PATH="$WORK/bin:$PATH"

cat >"$CAPTURE_OUTPUT" <<'LINES'
proxy 0x420000000000000000000000000000000000000F
code 0x420000000000000000000000000000000000000F 0x6080aa
slot 0x420000000000000000000000000000000000000F 0x0000000000000000000000000000000000000000000000000000000000000000 0x0000000000000000000000000000000000000000000000000000000001010101
impl 0x420000000000000000000000000000000000000F 0x4f1db3c6abd250ba86e0928471a8f7db3afd88f1
code 0x4f1db3c6abd250ba86e0928471a8f7db3afd88f1 0x6080bb
LINES

check "pins the foundry image by digest" "yes" \
    "$(grep -Eq 'FOUNDRY_IMAGE="ghcr.io/foundry-rs/foundry:v[0-9]+\.[0-9]+\.[0-9]+@sha256:[0-9a-f]{64}"' "$SCRIPT" && echo yes || echo no)"

bash "$SCRIPT" >/dev/null 2>&1
check "refuses a call without arguments" "1" "$?"

bash "$SCRIPT" http://insecure.example 1 "$WORK/out.ts" >/dev/null 2>&1
check "refuses a non-https RPC" "1" "$?"

bash "$SCRIPT" https://rpc.example latest "$WORK/out.ts" >/dev/null 2>&1
check "refuses a block that is not a number" "1" "$?"

: >"$RECORD"
bash "$SCRIPT" https://rpc.example 1234567 "$WORK/out.ts" >/dev/null 2>&1
check "captures from a valid RPC and block" "0" "$?"
check "runs cast through the pinned image" "yes" \
    "$(grep -Eq -e '--entrypoint sh ghcr.io/foundry-rs/foundry:v[0-9.]+@sha256:[0-9a-f]{64}' "$RECORD" && echo yes || echo no)"
check "passes the RPC, block and both predeploys as arguments" "yes" \
    "$(grep -q 'https://rpc.example 1234567 0x420000000000000000000000000000000000000F 0x4200000000000000000000000000000000000015' "$RECORD" && echo yes || echo no)"
check "names the pinned block" "yes" \
    "$(grep -q 'export const OP_STACK_PREDEPLOYS_BLOCK = 1_234_567n' "$WORK/out.ts" && echo yes || echo no)"
check "writes each account's code" "2" \
    "$(grep -cE "code: '0x6080(aa|bb)'" "$WORK/out.ts")"
check "writes the non-zero slot" "yes" \
    "$(grep -q "'0x0000000000000000000000000000000000000000000000000000000001010101'" "$WORK/out.ts" && echo yes || echo no)"
check "writes an empty storage list for the implementation" "yes" \
    "$(grep -q 'storage: \[\],' "$WORK/out.ts" && echo yes || echo no)"
check "carries the copyright header" "yes" \
    "$(grep -q 'Copyright 2022-2026 Pera Wallet, LDA' "$WORK/out.ts" && echo yes || echo no)"

sed -i.bak 's/^code 0x4f1db3c6abd250ba86e0928471a8f7db3afd88f1 0x6080bb$/code 0x4f1db3c6abd250ba86e0928471a8f7db3afd88f1 0x/' "$CAPTURE_OUTPUT"
rm -f "$WORK/empty.ts"
bash "$SCRIPT" https://rpc.example 123 "$WORK/empty.ts" >/dev/null 2>&1
check "fails when an account has no code" "1" "$?"
check "writes nothing when an account has no code" "no" \
    "$([ -e "$WORK/empty.ts" ] && echo yes || echo no)"

if [ "$failures" -ne 0 ]; then
    echo "$failures failure(s)"
    exit 1
fi
