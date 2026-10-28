#!/usr/bin/env bash
# tools/dev/evmnet.sh
# Manage the local Anvil nodes (one per EVM chain) the EVM conformance suite
# runs against. Purely container lifecycle: no app-config side effects.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_PATH="${SCRIPT_DIR}/evmnet.compose.yml"
CONTAINERS="pera_evmnet_ethereum pera_evmnet_base pera_evmnet_bsc pera_evmnet_arbitrum pera_evmnet_avalanche pera_evmnet_polygon"

usage() {
  cat >&2 <<EOF2
Usage: pnpm evmnet <command>

Commands:
  start    Start the Anvil nodes (waits until each is healthy)
  stop     Stop the Anvil nodes
  reset    Recreate the nodes from a fresh chain
  status   Show node status
  logs     Print each node's container logs
EOF2
  exit 1
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

# Never fails: it runs after a failed suite, whose exit code is the one to keep.
print_logs() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker not found; no evmnet container logs to show."
    return 0
  fi
  local name
  for name in $CONTAINERS; do
    echo ""
    echo "── docker logs ${name} (last 300 lines) ──"
    docker logs --tail 300 "$name" 2>&1 || true
  done
}

cmd="${1:-}"
case "$cmd" in
  start)
    require_docker
    docker compose -f "$COMPOSE_PATH" up -d --wait
    echo ""
    echo "✓ evmnet endpoints:"
    echo "  ethereum   http://127.0.0.1:8545  (chain id 11155111)"
    echo "  base       http://127.0.0.1:8546  (chain id 84532)"
    echo "  bsc        http://127.0.0.1:8547  (chain id 97)"
    echo "  arbitrum   http://127.0.0.1:8548  (chain id 421614)"
    echo "  avalanche  http://127.0.0.1:8549  (chain id 43113)"
    echo "  polygon    http://127.0.0.1:8550  (chain id 80002)"
    ;;
  stop)
    require_docker
    docker compose -f "$COMPOSE_PATH" down
    ;;
  reset)
    require_docker
    docker compose -f "$COMPOSE_PATH" down -v
    docker compose -f "$COMPOSE_PATH" up -d --wait
    ;;
  status)
    require_docker
    docker compose -f "$COMPOSE_PATH" ps
    ;;
  logs)
    print_logs
    ;;
  *)
    usage
    ;;
esac
