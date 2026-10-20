#!/usr/bin/env bash
# tools/dev/localnet.sh
# Manage a local Algorand LocalNet via the official AlgoKit CLI.
# Purely container lifecycle — no app-config side effects. The app is pointed at
# LocalNet at runtime via Settings > Developer > Node Settings > Custom network.
# localnet.compose.yml is layered over AlgoKit's sandbox to pin algod.
set -euo pipefail

TOKEN="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIN_FILE="${SCRIPT_DIR}/localnet.compose.yml"

# AlgoKit runs `docker compose` from its sandbox directory with our environment,
# so this layers the pin without writing into ~/.config/algokit, which other
# projects share. AlgoKit finds a running sandbox from the first file listed, so
# its own docker-compose.yml must stay first.
export COMPOSE_FILE="docker-compose.yml:${PIN_FILE}"

usage() {
  cat >&2 <<EOF
Usage: pnpm localnet <command>

Commands:
  start    Start the LocalNet (preflight checks Docker + AlgoKit)
  stop     Stop the LocalNet
  reset    Reset the LocalNet (fresh chain; genesis hash changes)
  status   Show LocalNet status
  logs     Print conduit's and indexer's container logs
EOF
  exit 1
}

require_algokit() {
  if ! command -v algokit >/dev/null 2>&1; then
    echo "ERROR: AlgoKit CLI not found." >&2
    echo "Install it: brew install algorandfoundation/tap/algokit" >&2
    echo "(or: pipx install algokit) — see https://dev.algorand.co/algokit/algokit-intro/" >&2
    exit 1
  fi
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker not found. Install Docker Desktop: https://docs.docker.com/get-docker/" >&2
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker daemon is not running. Start Docker and retry." >&2
    exit 1
  fi
}

pinned_algod_image() {
  sed -n 's/.*PERA_LOCALNET_ALGOD_IMAGE:-\([^}]*\)}.*/\1/p' "$PIN_FILE"
}

# Never fails: it runs after a failed suite, whose exit code is the one to keep.
print_logs() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker not found; no LocalNet container logs to show."
    return 0
  fi
  local name
  for name in algokit_sandbox_conduit algokit_sandbox_indexer; do
    echo ""
    echo "── docker logs ${name} (last 300 lines) ──"
    docker logs --tail 300 "$name" 2>&1 || true
  done
}

cmd="${1:-}"
case "$cmd" in
  start)
    require_docker
    require_algokit
    algokit localnet start
    echo ""
    echo "✓ LocalNet endpoints:"
    echo "  algod   http://localhost:4001   (token: ${TOKEN})"
    echo "  indexer http://localhost:8980"
    echo "  kmd     http://localhost:4002   (token: ${TOKEN})"
    echo "  algod image: ${PERA_LOCALNET_ALGOD_IMAGE:-$(pinned_algod_image)}"
    echo ""
    echo "Next: in the app, Settings > Developer > Node Settings > Custom network"
    ;;
  stop)
    require_algokit
    algokit localnet stop
    ;;
  reset)
    require_algokit
    algokit localnet reset
    echo "Note: genesis hash changed — re-enter the custom network config in the app." >&2
    ;;
  status)
    require_algokit
    algokit localnet status
    ;;
  logs)
    print_logs
    ;;
  *)
    usage
    ;;
esac
