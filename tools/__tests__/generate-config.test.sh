#!/usr/bin/env bash
set -uo pipefail

# Pins that generate-config.sh bakes env values into generated-env.ts as inert
# string literals. Each case feeds a hostile value and reads the generated
# object back with node: the value must round-trip exactly and no extra key
# may appear.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dev/generate-config.sh"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

failures=0

# $1 label  $2 value for MAINNET_BACKEND_URL
run_case() {
    local label="$1" value="$2"
    local out="$WORK/generated-env.ts"

    if ! env -i PATH="$PATH" HOME="$HOME" ENV_FILE="$WORK/missing.env" \
        OUTPUT_FILE="$out" MAINNET_BACKEND_URL="$value" \
        bash "$SCRIPT" > "$WORK/log" 2>&1; then
        echo "  FAIL  ${label}: generate-config.sh exited non-zero"
        sed 's/^/        /' "$WORK/log"
        failures=$((failures + 1))
        return
    fi

    local result
    result=$(EXPECTED="$value" GENERATED="$out" node -e '
        const fs = require("fs")
        const source = fs
            .readFileSync(process.env.GENERATED, "utf8")
            .replace("export const generatedEnv =", "return")
            .replace("} as const;", "}")
        const env = new Function(source)()
        const keys = Object.keys(env)
        if (keys.length !== 1 || keys[0] !== "mainnetBackendUrl") {
            console.log("unexpected keys: " + JSON.stringify(keys))
        } else if (env.mainnetBackendUrl !== process.env.EXPECTED) {
            console.log("value changed: " + JSON.stringify(env.mainnetBackendUrl))
        } else {
            console.log("ok")
        }
    ' 2>&1)
    if [ "$result" = "ok" ]; then
        echo "  ok    ${label}"
    else
        echo "  FAIL  ${label}: ${result}"
        failures=$((failures + 1))
    fi
}

# $1 label  $2 CHAINS  $3 ETHEREUM_SEPOLIA_RPC_URL  $4 expected stderr, or "" to expect success
run_guard_case() {
    local label="$1" chains="$2" sepolia_rpc="$3" expected="$4"
    local status=0

    env -i PATH="$PATH" HOME="$HOME" ENV_FILE="$WORK/missing.env" \
        OUTPUT_FILE="$WORK/generated-env.ts" CHAINS="$chains" \
        ETHEREUM_MAINNET_RPC_URL='https://mainnet.rpc.example' \
        ETHEREUM_SEPOLIA_RPC_URL="$sepolia_rpc" \
        bash "$SCRIPT" > "$WORK/log" 2>&1 || status=$?

    if [ -z "$expected" ] && [ "$status" -eq 0 ]; then
        echo "  ok    ${label}"
    elif [ -n "$expected" ] && [ "$status" -ne 0 ] && grep -q "$expected" "$WORK/log"; then
        echo "  ok    ${label}"
    else
        echo "  FAIL  ${label}: exit ${status}"
        sed 's/^/        /' "$WORK/log"
        failures=$((failures + 1))
    fi
}

echo "generate-config.sh"
run_case "plain url" 'https://mainnet.api.perawallet.app'
run_case "double quote cannot end the literal" 'x", injected: "1'
run_case "backslash is kept, not an escape" 'a\", injected: 1, b: "\'
run_case "newline cannot start a new property" $'x",\n  injected: 1,\n  y: "'
run_case "comment closer is inert" '*/ throw new Error("boom") /*'
run_case "control character is escaped" $'bell\a'
run_case "leading dash is not a node option" '-e "x'
run_guard_case "a build shipping ethereum needs every RPC URL" \
    'algorand,ethereum' '' 'ETHEREUM_SEPOLIA_RPC_URL is unset but CHAINS ships ethereum'
run_guard_case "a build shipping ethereum with every RPC URL passes" \
    'algorand,ethereum' 'https://sepolia.rpc.example' ''
run_guard_case "a build without ethereum needs no RPC URL" \
    'algorand' '' ''

if [ "$failures" -gt 0 ]; then
    echo "${failures} case(s) failed"
    exit 1
fi
