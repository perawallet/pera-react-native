#!/usr/bin/env bash
set -uo pipefail

# CI and developers start the EVM nodes through evmnet.sh and run the suite
# through conformance-evm.sh, so these are the only places the image pin, the
# chain ids and the failure logs can live. Docker and pnpm are stubbed: each
# records how it was called.

DEV="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dev"
EVMNET="$DEV/evmnet.sh"
CONFORMANCE="$DEV/conformance-evm.sh"
COMPOSE_FILE_PATH="$DEV/evmnet.compose.yml"
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

BASH_BIN=$(command -v bash)
export RECORD="$WORK/record"

mkdir -p "$WORK/bin"
cat >"$WORK/bin/docker" <<'STUB'
#!/usr/bin/env bash
[ "$1" = info ] && exit 0
printf 'docker %s\n' "$*" >>"$RECORD"
exit "${STUB_DOCKER_STATUS:-0}"
STUB
cat >"$WORK/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
printf 'pnpm %s\n' "$*" >>"$RECORD"
exit "${STUB_PNPM_STATUS:-0}"
STUB
chmod +x "$WORK/bin/docker" "$WORK/bin/pnpm"
export PATH="$WORK/bin:$PATH"

run() { # $@ command line -> stdout, with the record reset first
    : >"$RECORD"
    "$@" 2>&1
}
recorded() { # $1 prefix -> matching record lines, without the prefix
    grep "^$1 " "$RECORD" | sed "s/^$1 //"
}

check "pins the foundry image by digest" "yes" \
    "$(grep -Eq 'image: ghcr.io/foundry-rs/foundry:v[0-9]+\.[0-9]+\.[0-9]+@sha256:[0-9a-f]{64}' "$COMPOSE_FILE_PATH" && echo yes || echo no)"
check "every service overrides the entrypoint to anvil" "6" \
    "$(grep -c 'entrypoint: \["anvil"\]' "$COMPOSE_FILE_PATH")"

# service container port chain-id
TABLE="pera_evmnet_ethereum 8545 11155111
pera_evmnet_base 8546 84532
pera_evmnet_bsc 8547 97
pera_evmnet_arbitrum 8548 421614
pera_evmnet_avalanche 8549 43113
pera_evmnet_polygon 8550 80002"
while read -r name port id; do
    block=$(awk -v n="container_name: $name" '
        /^  [a-z]+:$/ { if (found) exit; buf = "" }
        { buf = buf $0 "\n" }
        index($0, n) { found = 1 }
        END { printf "%s", buf }' "$COMPOSE_FILE_PATH")
    check "$name serves chain id $id" "yes" \
        "$(echo "$block" | grep -q -- "- \"$id\"" && echo "$block" | grep -q -- '- "--chain-id"' && echo yes || echo no)"
    check "$name binds port $port" "yes" \
        "$(echo "$block" | grep -q "127.0.0.1:$port:8545" && echo yes || echo no)"
done <<<"$TABLE"
check "base runs the OP-stack mode" "1" \
    "$(grep -c -- '--optimism' "$COMPOSE_FILE_PATH")"

run "$BASH_BIN" "$EVMNET" start >/dev/null
check "start brings the nodes up and waits for health" \
    "compose -f $COMPOSE_FILE_PATH up -d --wait" "$(recorded docker)"

run "$BASH_BIN" "$EVMNET" stop >/dev/null
check "stop takes the nodes down" \
    "compose -f $COMPOSE_FILE_PATH down" "$(recorded docker)"

run "$BASH_BIN" "$EVMNET" reset >/dev/null
check "reset recreates the nodes from a fresh chain" \
    "compose -f $COMPOSE_FILE_PATH down -v
compose -f $COMPOSE_FILE_PATH up -d --wait" "$(recorded docker)"

run "$BASH_BIN" "$EVMNET" status >/dev/null
check "status lists the nodes" \
    "compose -f $COMPOSE_FILE_PATH ps" "$(recorded docker)"

EXPECTED_LOGS=$(echo "$TABLE" | awk '{ print "logs --tail 300 " $1 }')
run "$BASH_BIN" "$EVMNET" logs >/dev/null
check "logs dumps every node" "$EXPECTED_LOGS" "$(recorded docker)"

STUB_DOCKER_STATUS=1 run "$BASH_BIN" "$EVMNET" logs >/dev/null
check "logs succeeds when the containers are missing" "0" "$?"

mkdir -p "$WORK/nodocker"
ln -s "$(command -v dirname)" "$WORK/nodocker/dirname"
out=$(PATH="$WORK/nodocker" run "$BASH_BIN" "$EVMNET" logs)
check "logs succeeds without docker installed" "0" "$?"
check "and says why there is nothing to show" "yes" \
    "$(echo "$out" | grep -qi "docker not found" && echo yes || echo no)"

STUB_PNPM_STATUS=0 run "$BASH_BIN" "$CONFORMANCE" >/dev/null
check "a passing suite exits 0" "0" "$?"
check "and dumps no logs" "" "$(recorded docker)"

out=$(STUB_PNPM_STATUS=1 run "$BASH_BIN" "$CONFORMANCE")
check "a failing suite exits non-zero" "1" "$?"
check "and dumps every node's logs" "$EXPECTED_LOGS" "$(recorded docker)"
check "and announces the dump" "yes" \
    "$(echo "$out" | grep -qF "EVM conformance failed; evmnet container logs follow." && echo yes || echo no)"

STUB_PNPM_STATUS=3 STUB_DOCKER_STATUS=1 run "$BASH_BIN" "$CONFORMANCE" >/dev/null
check "keeps the suite's exit code when the log dump fails" "3" "$?"

run "$BASH_BIN" "$CONFORMANCE" src/suites/send --reporter=verbose >/dev/null
check "forwards arguments to the suite" \
    "--filter @perawallet/conformance-evm test:conformance src/suites/send --reporter=verbose" \
    "$(recorded pnpm)"

if [ "$failures" -gt 0 ]; then
    echo "evmnet: ${failures} failure(s)"
    exit 1
fi
echo "evmnet: all checks passed"
