#!/usr/bin/env bash
set -uo pipefail

# CI starts LocalNet through localnet.sh and runs the suite through
# conformance.sh, so these are the only places the algod pin and the failure
# logs can live. AlgoKit, Docker and pnpm are stubbed: each records how it was
# called.

DEV="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dev"
LOCALNET="$DEV/localnet.sh"
CONFORMANCE="$DEV/conformance.sh"
PIN_FILE="$DEV/localnet.compose.yml"
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
cat >"$WORK/bin/algokit" <<'EOF'
#!/usr/bin/env bash
printf 'algokit %s|%s\n' "$*" "${COMPOSE_FILE:-}" >>"$RECORD"
EOF
cat >"$WORK/bin/docker" <<'EOF'
#!/usr/bin/env bash
[ "$1" = info ] && exit 0
printf 'docker %s\n' "$*" >>"$RECORD"
exit "${STUB_DOCKER_STATUS:-0}"
EOF
cat >"$WORK/bin/pnpm" <<'EOF'
#!/usr/bin/env bash
printf 'pnpm %s\n' "$*" >>"$RECORD"
exit "${STUB_PNPM_STATUS:-0}"
EOF
chmod +x "$WORK/bin/algokit" "$WORK/bin/docker" "$WORK/bin/pnpm"
export PATH="$WORK/bin:$PATH"

run() { # $@ command line -> stdout, with the record reset first
    : >"$RECORD"
    "$@" 2>&1
}
recorded() { # $1 prefix -> matching record lines, without the prefix
    grep "^$1 " "$RECORD" | sed "s/^$1 //"
}

PINNED=$(sed -n 's/.*PERA_LOCALNET_ALGOD_IMAGE:-\([^}]*\)}.*/\1/p' "$PIN_FILE")
check "pins algod to a versioned stable tag, never a moving one" "yes" \
    "$(echo "$PINNED" | grep -Eq '^algorand/algod:[0-9]+\.[0-9]+\.[0-9]+-stable$' && echo yes || echo no)"

# AlgoKit finds its running sandbox from the FIRST compose file, so its own
# docker-compose.yml has to lead.
EXPECTED_COMPOSE="docker-compose.yml:$PIN_FILE"
out=$(run "$BASH_BIN" "$LOCALNET" start)
check "start layers the pin over AlgoKit's compose file" \
    "localnet start|$EXPECTED_COMPOSE" "$(recorded algokit)"
check "start reports the pinned algod image" "yes" \
    "$(echo "$out" | grep -qF "algod image: $PINNED" && echo yes || echo no)"

out=$(PERA_LOCALNET_ALGOD_IMAGE=algorand/algod:latest run "$BASH_BIN" "$LOCALNET" start)
check "start reports an overridden algod image" "yes" \
    "$(echo "$out" | grep -qF "algod image: algorand/algod:latest" && echo yes || echo no)"

run "$BASH_BIN" "$LOCALNET" reset >/dev/null
check "reset layers the pin too" "localnet reset|$EXPECTED_COMPOSE" "$(recorded algokit)"

EXPECTED_LOGS="logs --tail 300 algokit_sandbox_conduit
logs --tail 300 algokit_sandbox_indexer"
run "$BASH_BIN" "$LOCALNET" logs >/dev/null
check "logs dumps conduit and indexer" "$EXPECTED_LOGS" "$(recorded docker)"

STUB_DOCKER_STATUS=1 run "$BASH_BIN" "$LOCALNET" logs >/dev/null
check "logs succeeds when the containers are missing" "0" "$?"

mkdir -p "$WORK/nodocker"
ln -s "$(command -v dirname)" "$WORK/nodocker/dirname"
out=$(PATH="$WORK/nodocker" run "$BASH_BIN" "$LOCALNET" logs)
check "logs succeeds without docker installed" "0" "$?"
check "and says why there is nothing to show" "yes" \
    "$(echo "$out" | grep -qi "docker not found" && echo yes || echo no)"

STUB_PNPM_STATUS=0 run "$BASH_BIN" "$CONFORMANCE" >/dev/null
check "a passing suite exits 0" "0" "$?"
check "and dumps no logs" "" "$(recorded docker)"

STUB_PNPM_STATUS=1 run "$BASH_BIN" "$CONFORMANCE" >/dev/null
check "a failing suite exits non-zero" "1" "$?"
check "and dumps conduit and indexer logs" "$EXPECTED_LOGS" "$(recorded docker)"

STUB_PNPM_STATUS=3 STUB_DOCKER_STATUS=1 run "$BASH_BIN" "$CONFORMANCE" >/dev/null
check "keeps the suite's exit code when the log dump fails" "3" "$?"

run "$BASH_BIN" "$CONFORMANCE" src/suites/history --reporter=verbose >/dev/null
check "forwards arguments to the suite" \
    "--filter @perawallet/conformance test:conformance src/suites/history --reporter=verbose" \
    "$(recorded pnpm)"

if [ "$failures" -gt 0 ]; then
    echo "localnet: ${failures} failure(s)"
    exit 1
fi
echo "localnet: all checks passed"
