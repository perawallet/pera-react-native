#!/usr/bin/env bash
# tools/use-localnet.sh
# Wire (on) or unwire (off) the app's build-time config to point the TESTNET
# slot at a running LocalNet. Regenerates packages/config/src/generated-env.ts.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OVERLAY="$ROOT_DIR/.env.localnet"
TOKEN="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
ALGOD="http://localhost:4001"

usage() {
  echo "Usage: pnpm localnet:use   |   pnpm localnet:unset" >&2
  echo "  on   Point the app's testnet slot at LocalNet (requires it running)" >&2
  echo "  off  Restore live endpoints from .env" >&2
  exit 1
}

fetch_genesis_hash() {
  curl -sf -H "X-Algo-API-Token: $TOKEN" "$ALGOD/v2/transactions/params" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{process.stdout.write(JSON.parse(d)['genesis-hash']||'')}catch(e){process.exit(1)}})"
}

mode="${1:-on}"
case "$mode" in
  on)
    if [ ! -f "$OVERLAY" ]; then
      echo "ERROR: $OVERLAY not found." >&2
      exit 1
    fi
    GH="$(fetch_genesis_hash || true)"
    if [ -z "$GH" ]; then
      echo "ERROR: LocalNet not reachable at $ALGOD." >&2
      echo "Start it first: pnpm localnet" >&2
      exit 1
    fi
    # Build an effective overlay = .env.localnet + live genesis hash.
    EFFECTIVE="$(mktemp)"
    trap 'rm -f "$EFFECTIVE"' EXIT
    cat "$OVERLAY" > "$EFFECTIVE"
    printf '\nTESTNET_GENESIS_HASH=%s\n' "$GH" >> "$EFFECTIVE"
    PERA_ENV_OVERLAY="$EFFECTIVE" bash "$SCRIPT_DIR/generate-config.sh"
    echo "✓ App config now points TESTNET at LocalNet (genesis $GH)."
    echo "  Rebuild/restart the app (pnpm ios | pnpm android) to pick it up."
    ;;
  off)
    bash "$SCRIPT_DIR/generate-config.sh"
    echo "✓ App config restored to live endpoints from .env."
    ;;
  *)
    usage
    ;;
esac
