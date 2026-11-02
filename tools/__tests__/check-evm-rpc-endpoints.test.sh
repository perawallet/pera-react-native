#!/usr/bin/env bash
set -uo pipefail

# Pins check-evm-rpc-endpoints.mjs, the release gate that probes every baked EVM
# RPC URL. Each case runs the script against fake JSON-RPC nodes started here, so
# the failing paths (wrong network, dead node, untrusted production host) are
# really exercised.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/check-evm-rpc-endpoints.mjs"
WORK=$(mktemp -d)
PIDS=()
cleanup() {
    for pid in "${PIDS[@]:-}"; do
        [ -n "$pid" ] && kill "$pid" 2>/dev/null && wait "$pid" 2>/dev/null
    done
    rm -rf "$WORK"
}
trap cleanup EXIT

failures=0

# Starts a node answering eth_chainId with the given hex id in this shell, so
# cleanup can kill it, and sets NODE_URL to its base URL.
# $1 hex chain id
start_node() {
    local out="$WORK/node.$RANDOM"
    CHAIN_ID="$1" node -e '
        const http = require("http")
        const server = http.createServer((req, res) => {
            req.resume()
            req.on("end", () => {
                res.setHeader("content-type", "application/json")
                res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: process.env.CHAIN_ID }))
            })
        })
        server.listen(0, "127.0.0.1", () => {
            console.log("http://127.0.0.1:" + server.address().port)
        })
    ' > "$out" &
    PIDS+=("$!")
    for _ in $(seq 1 50); do
        [ -s "$out" ] && break
        sleep 0.1
    done
    NODE_URL=$(cat "$out")
}

# A port nothing listens on.
closed_url() {
    node -e '
        const server = require("net").createServer()
        server.listen(0, "127.0.0.1", () => {
            const port = server.address().port
            server.close(() => console.log("http://127.0.0.1:" + port))
        })
    '
}

start_node 0x1
MAINNET_NODE="$NODE_URL"
start_node 0xaa36a7
SEPOLIA_NODE="$NODE_URL"
DEAD_NODE=$(closed_url)

# $1 label  $2 expected exit code (0 or 1)  $3 expected output fragment, or ""  $4... env assignments
run_case() {
    local label="$1" expected_status="$2" expected_text="$3"
    shift 3
    local status=0
    env -i PATH="$PATH" HOME="$HOME" "$@" node "$SCRIPT" > "$WORK/log" 2>&1 || status=$?

    if [ "$status" -ne "$expected_status" ]; then
        echo "  FAIL  ${label}: exit ${status}, expected ${expected_status}"
        sed 's/^/        /' "$WORK/log"
        failures=$((failures + 1))
    elif [ -n "$expected_text" ] && ! grep -qF -- "$expected_text" "$WORK/log"; then
        echo "  FAIL  ${label}: output lacks '${expected_text}'"
        sed 's/^/        /' "$WORK/log"
        failures=$((failures + 1))
    else
        echo "  ok    ${label}"
    fi
}

echo "check-evm-rpc-endpoints.mjs"
run_case "a mainnet URL answering the Sepolia chain id fails" 1 \
    "ETHEREUM_MAINNET_RPC_URL ${SEPOLIA_NODE} — serves chain id 11155111, expected 1" \
    ETHEREUM_MAINNET_RPC_URL="$SEPOLIA_NODE"
run_case "a mainnet URL answering the mainnet chain id passes" 0 \
    "PASS ETHEREUM_MAINNET_RPC_URL" \
    ETHEREUM_MAINNET_RPC_URL="$MAINNET_NODE"
run_case "every network is checked against its own chain id" 0 "" \
    ETHEREUM_MAINNET_RPC_URL="$MAINNET_NODE" ETHEREUM_SEPOLIA_RPC_URL="$SEPOLIA_NODE"
run_case "an unreachable URL only warns outside production" 0 \
    "WARN ETHEREUM_MAINNET_RPC_URL" \
    ETHEREUM_MAINNET_RPC_URL="$MAINNET_NODE, $DEAD_NODE"
run_case "an unreachable URL fails a production build" 1 \
    "unreachable" \
    APP_ENV=production ETHEREUM_SEPOLIA_RPC_URL="$SEPOLIA_NODE,$DEAD_NODE"
run_case "a wrong network still fails outside production" 1 \
    "serves chain id 11155111" \
    ETHEREUM_MAINNET_RPC_URL="$MAINNET_NODE,$SEPOLIA_NODE"
run_case "a build with no EVM endpoints has nothing to check" 0 "nothing to check"
run_case "production refuses a main mainnet node off a pinned domain" 1 \
    "the main production mainnet endpoint must be on a pinned domain" \
    APP_ENV=production ETHEREUM_MAINNET_RPC_URL="$MAINNET_NODE"
# The first URL is unreachable here (no such host), so the case reads the host
# rules from the output: the plain-http fallback is refused, and the main
# node's pinned domain is not what fails.
run_case "production requires a fallback to be https but not pinned" 1 \
    "a production mainnet endpoint must be https" \
    APP_ENV=production ETHEREUM_MAINNET_RPC_URL="https://rpc.perawallet.app,$MAINNET_NODE"
if grep -q "pinned domain" "$WORK/log"; then
    echo "  FAIL  production held the fallback to the pinned domain"
    failures=$((failures + 1))
fi
run_case "production leaves a testnet URL off a pinned domain alone" 0 "" \
    APP_ENV=production ETHEREUM_SEPOLIA_RPC_URL="$SEPOLIA_NODE"
run_case "staging leaves a mainnet URL off a pinned domain alone" 0 "" \
    APP_ENV=staging ETHEREUM_MAINNET_RPC_URL="$MAINNET_NODE"

run_case "the probe prints a URL's origin only" 0 "PASS ETHEREUM_MAINNET_RPC_URL ${MAINNET_NODE} — chain id 1" \
    ETHEREUM_MAINNET_RPC_URL="$MAINNET_NODE/v2/secret-key"
if grep -q "secret-key" "$WORK/log"; then
    echo "  FAIL  the probe printed a URL path"
    failures=$((failures + 1))
fi

if [ "$failures" -gt 0 ]; then
    echo "${failures} case(s) failed"
    exit 1
fi
