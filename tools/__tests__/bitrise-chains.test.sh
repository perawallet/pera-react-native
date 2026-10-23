#!/usr/bin/env bash
set -uo pipefail

# Which chains a channel ships is decided by the CHAINS each Bitrise workflow
# sets, so a dropped or widened entry here silently changes what testers or
# store users get.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BITRISE_YML="$ROOT_DIR/.bitrise/bitrise.yml"

failures=0

# The Pera services the staging backend serves for every EVM network; change
# them only with the backend.
EVM_STAGING_SERVICES="prices,assets,history,blockFollowing"

# Every EVM chain and network, from the table generate-config.sh bakes from.
EVM_CONFIG="$(node "$ROOT_DIR/tools/dev/evm-config-keys.cjs")"
EVM_CHAIN_IDS="$(awk '$1 == "chain" { print $2 }' <<< "$EVM_CONFIG" | paste -sd, -)"
EVM_SCOPE_ENVS="$(awk '$1 == "scope" { print $3, $5 }' <<< "$EVM_CONFIG")"
if [ -z "$EVM_CHAIN_IDS" ] || [ -z "$EVM_SCOPE_ENVS" ]; then
    echo "FAIL  evm-config-keys.cjs listed no EVM chains or networks"
    exit 1
fi

check() { # $1 label  $2 expected  $3 actual
    if [ "$2" = "$3" ]; then
        echo "  ok    $1"
    else
        echo "  FAIL  $1: expected '$2', got '$3'"
        failures=$((failures + 1))
    fi
}

# The last entry wins: Bitrise applies a workflow's envs in order.
workflow_env() { # $1 workflow  $2 KEY
    awk -v workflow="  $1:" -v key="$2" '
        $0 == workflow { inside = 1; next }
        inside && /^  [A-Za-z_-]+:$/ { exit }
        inside && index($0, "    - " key ": ") == 1 {
            value = substr($0, length("    - " key ": ") + 1)
            if (value ~ /^".*"$/ || value ~ /^'\''.*'\''$/) {
                value = substr(value, 2, length(value) - 2)
            }
            found = 1
        }
        END { if (found) print value }
    ' "$BITRISE_YML"
}

echo "bitrise.yml chain env"
check "the parser finds a workflow's envs" "staging" "$(workflow_env ios-staging APP_ENV)"

for workflow in ios-staging android-staging web-staging; do
    check "${workflow} ships every chain" \
        "algorand,${EVM_CHAIN_IDS}" "$(workflow_env "$workflow" CHAINS)"
    while read -r rpc_env services_env; do
        url="$(workflow_env "$workflow" "$rpc_env")"
        check "${workflow} sets an https ${rpc_env}" "yes" \
            "$([[ "$url" == https://?* ]] && echo yes || echo "no (${url})")"
        check "${workflow} lists the ${services_env}" \
            "$EVM_STAGING_SERVICES" "$(workflow_env "$workflow" "$services_env")"
    done <<< "$EVM_SCOPE_ENVS"
done

for workflow in ios-production android-production web-production; do
    check "${workflow} pins Algorand alone" \
        "algorand" "$(workflow_env "$workflow" CHAINS)"
    while read -r rpc_env services_env; do
        for key in "$rpc_env" "$services_env"; do
            check "${workflow} sets no ${key}" "" "$(workflow_env "$workflow" "$key")"
        done
    done <<< "$EVM_SCOPE_ENVS"
done

if [ "$failures" -gt 0 ]; then
    echo "${failures} case(s) failed"
    exit 1
fi
