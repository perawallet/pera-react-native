#!/usr/bin/env bash
# tools/dev/conformance-evm.sh
# Runs the EVM conformance suite. On failure it prints every Anvil node's
# container logs, so a node that misbehaved shows its cause in the same output
# (in CI, the job log).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

status=0
pnpm --filter @perawallet/conformance-evm test:conformance "$@" || status=$?

if [ "$status" -ne 0 ]; then
  echo ""
  echo "EVM conformance failed; evmnet container logs follow."
  bash "${SCRIPT_DIR}/evmnet.sh" logs
fi

exit "$status"
