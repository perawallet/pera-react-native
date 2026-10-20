#!/usr/bin/env bash
# tools/dev/conformance.sh
# Runs the conformance suite. On failure it prints conduit's and indexer's
# container logs, so an indexer that never ingests shows its cause in the same
# output (in CI, the job log).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

status=0
pnpm --filter @perawallet/conformance test:conformance "$@" || status=$?

if [ "$status" -ne 0 ]; then
  echo ""
  echo "Conformance failed; LocalNet container logs follow."
  bash "${SCRIPT_DIR}/localnet.sh" logs
fi

exit "$status"
