#!/usr/bin/env bash
# tools/localnet.sh
# Manage a local Algorand LocalNet via the official AlgoKit CLI.
# Purely container lifecycle — no app-config side effects. The app is pointed at
# LocalNet at runtime via Settings > Developer > Node Settings > Custom network.
set -euo pipefail

TOKEN="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

usage() {
  cat >&2 <<EOF
Usage: pnpm localnet <command>

Commands:
  start    Start the LocalNet (preflight checks Docker + AlgoKit)
  stop     Stop the LocalNet
  reset    Reset the LocalNet (fresh chain; genesis hash changes)
  status   Show LocalNet status
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
  *)
    usage
    ;;
esac
