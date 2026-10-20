#!/usr/bin/env bash
set -uo pipefail

# Which chains a channel ships is decided by the CHAINS each Bitrise workflow
# sets, so a dropped or widened entry here silently changes what testers or
# store users get.

BITRISE_YML="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.bitrise/bitrise.yml"

failures=0
check() { # $1 label  $2 expected  $3 actual
    if [ "$2" = "$3" ]; then
        echo "  ok    $1"
    else
        echo "  FAIL  $1: expected '$2', got '$3'"
        failures=$((failures + 1))
    fi
}

workflow_env() { # $1 workflow  $2 KEY
    awk -v workflow="  $1:" -v key="$2" '
        $0 == workflow { inside = 1; next }
        inside && /^  [A-Za-z_-]+:$/ { exit }
        inside && index($0, "    - " key ": ") == 1 {
            value = substr($0, length("    - " key ": ") + 1)
            if (value ~ /^".*"$/ || value ~ /^'\''.*'\''$/) {
                value = substr(value, 2, length(value) - 2)
            }
            print value
            exit
        }
    ' "$BITRISE_YML"
}

echo "bitrise.yml chain env"
check "the parser finds a workflow's envs" "staging" "$(workflow_env ios-staging APP_ENV)"

for workflow in ios-staging android-staging web-staging; do
    check "${workflow} ships Algorand and Ethereum" \
        "algorand,ethereum" "$(workflow_env "$workflow" CHAINS)"
    for key in ETHEREUM_MAINNET_RPC_URL ETHEREUM_SEPOLIA_RPC_URL; do
        url="$(workflow_env "$workflow" "$key")"
        check "${workflow} sets an https ${key}" "yes" \
            "$([[ "$url" == https://?* ]] && echo yes || echo "no (${url})")"
    done
done

for workflow in ios-production android-production web-production; do
    check "${workflow} pins Algorand alone" \
        "algorand" "$(workflow_env "$workflow" CHAINS)"
    for key in ETHEREUM_MAINNET_RPC_URL ETHEREUM_SEPOLIA_RPC_URL; do
        check "${workflow} sets no ${key}" "" "$(workflow_env "$workflow" "$key")"
    done
done

if [ "$failures" -gt 0 ]; then
    echo "${failures} case(s) failed"
    exit 1
fi
