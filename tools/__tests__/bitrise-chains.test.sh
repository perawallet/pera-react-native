#!/usr/bin/env bash
set -uo pipefail

# Which chains a channel ships is decided by the CHAINS each Bitrise workflow
# and pera-ci job sets, so a dropped or widened entry here silently changes
# what testers or store users get.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BITRISE_YML="$ROOT_DIR/.bitrise/bitrise.yml"
PIPELINES_YML="$ROOT_DIR/ci/pipelines.yml"

failures=0

# The Pera services the backend serves for every EVM network; change them only
# with the backend. NFTs are served for Ethereum alone: the backend
# answers 422 `nft_not_supported` on any other network that lists `nfts`.
EVM_STAGING_SERVICES="prices,assets,history,blockFollowing,contracts,simulations,tokenSearch"
ETHEREUM_STAGING_SERVICES="prices,assets,history,blockFollowing,nfts,contracts,simulations,tokenSearch"

# Every build-gated chain and network, from the table generate-config.sh bakes
# from. The expectations below are chain-ethereum's; another chain package
# needs its own.
CHAIN_CONFIG="$(node "$ROOT_DIR/tools/dev/chain-packages.cjs")"
EVM_PACKAGE="@perawallet/wallet-core-chain-ethereum"
evm_field_envs() { # $1 field
    awk -v pkg="$EVM_PACKAGE" -v field="$1" \
        '$1 == "scope" && $6 == pkg && $7 == field { print $4 }' <<< "$CHAIN_CONFIG"
}
GATED_CHAIN_IDS="$(awk '$1 == "chain" { print $2 }' <<< "$CHAIN_CONFIG")"
EVM_RPC_URL_ENVS="$(evm_field_envs rpcUrl)"
EVM_SERVICES_ENVS="$(evm_field_envs peraServices)"
if [ -z "$GATED_CHAIN_IDS" ] || [ -z "$EVM_RPC_URL_ENVS" ] || [ -z "$EVM_SERVICES_ENVS" ]; then
    echo "FAIL  chain-packages.cjs listed no chains, or no ${EVM_PACKAGE} RPC URLs or service lists"
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

provider_of() { # $1 URL -> the last two labels of its hostname
    local host="${1#*://}"
    host="${host%%/*}"
    host="${host%%:*}"
    awk -F. '{ print (NF > 1 ? $(NF - 1) "." $NF : $0) }' <<< "$host"
}

# One provider failing must not take the network down, so a list is the main
# node and a fallback on another provider, both over https.
two_provider_list() { # $1 comma list -> "yes", or "no (<reason>)"
    local -a urls
    if [[ "$1" == *, ]]; then
        echo "no (trailing comma: $1)"
        return
    fi
    IFS=, read -r -a urls <<< "$1"
    if [ "${#urls[@]}" -ne 2 ]; then
        echo "no (expected 2 URLs, got ${#urls[@]}: $1)"
        return
    fi
    local url
    for url in "${urls[@]}"; do
        [[ "$url" == https://?* ]] || { echo "no (not https: ${url})"; return; }
    done
    if [ "$(provider_of "${urls[0]}")" = "$(provider_of "${urls[1]}")" ]; then
        echo "no (both on $(provider_of "${urls[0]}"): $1)"
        return
    fi
    echo yes
}

# The app registers chains in module order, so CHAINS is a set.
sorted_csv() { tr ',' '\n' <<< "$1" | sort | paste -sd, -; }

# The last entry wins: Bitrise applies a workflow's envs in order. A block ends
# at the next line indented no deeper than its header.
yaml_env() { # $1 file  $2 header  $3 entry prefix  $4 KEY
    awk -v header="$2:" -v prefix="$3$4: " '
        $0 == header { inside = 1; match(header, /^ */); depth = RLENGTH; next }
        inside && NF && match($0, /^ */) && RLENGTH <= depth { exit }
        inside && index($0, prefix) == 1 {
            value = substr($0, length(prefix) + 1)
            if (value ~ /^".*"$/ || value ~ /^'\''.*'\''$/) {
                value = substr(value, 2, length(value) - 2)
            }
            found = 1
        }
        END { if (found) print value }
    ' "$1"
}
bitrise_env() { yaml_env "$BITRISE_YML" "  $1" "    - " "$2"; }
pipelines_env() { yaml_env "$PIPELINES_YML" "      $1" "          " "$2"; }

for source in bitrise pipelines; do
    env_of="${source}_env"

    echo "${source} chain env"
    check "the parser finds a job's envs" "staging" "$("$env_of" ios-staging APP_ENV)"

    for job in ios-staging android-staging web-staging ios-production android-production web-production; do
        check "${job} ships every chain" \
            "$(sorted_csv "algorand,$(paste -sd, - <<< "$GATED_CHAIN_IDS")")" \
            "$(sorted_csv "$("$env_of" "$job" CHAINS)")"
        while read -r rpc_env; do
            check "${job} gives ${rpc_env} a main node and a fallback provider" "yes" \
                "$(two_provider_list "$("$env_of" "$job" "$rpc_env")")"
        done <<< "$EVM_RPC_URL_ENVS"
        while read -r services_env; do
            expected="$EVM_STAGING_SERVICES"
            [[ "$services_env" == ETHEREUM_* ]] && expected="$ETHEREUM_STAGING_SERVICES"
            check "${job} lists the ${services_env}" \
                "$expected" "$("$env_of" "$job" "$services_env")"
        done <<< "$EVM_SERVICES_ENVS"
    done
done

# Production mobile reads its mainnets through Pera's RPC proxy first. Testnets
# and staging stay on public nodes so they don't spend the proxy's provider
# credits, and the extension can't use the proxy: it carries no API key and the
# proxy refuses web tokens.
EVM_PROXY_ROUTES="$(node -e '
    const nets = require(process.argv[1])
    for (const [chain, { networks }] of Object.entries(nets))
        for (const n of networks)
            console.log(`${chain}_${n.id}_RPC_URL`.toUpperCase(), n.tier, n.eip155ChainId)
' "$ROOT_DIR/packages/chain-contract/src/models/evm-networks.json")"
for source in bitrise pipelines; do
    env_of="${source}_env"
    echo "${source} RPC proxy"
    for job in ios-staging android-staging ios-production android-production web-staging web-production; do
        while read -r rpc_env tier eip155_id; do
            list="$("$env_of" "$job" "$rpc_env")"
            if [[ "$tier" == mainnet && ( "$job" == ios-production || "$job" == android-production ) ]]; then
                check "${job} reads ${rpc_env} through the proxy first" \
                    "https://${tier}.api.perawallet.app/api/v3/evm/${eip155_id}/rpc" "${list%%,*}"
            else
                [[ "$list" == *perawallet.app* ]] && list="pera" || list="public"
                check "${job} keeps ${rpc_env} on public nodes" "public" "$list"
            fi
        done <<< "$EVM_PROXY_ROUTES"
    done
done

echo "bitrise and pipelines agree"
for job in ios-staging android-staging web-staging ios-production android-production web-production; do
    while read -r rpc_env; do
        check "${job} gives ${rpc_env} the same list in both files" \
            "$(bitrise_env "$job" "$rpc_env")" "$(pipelines_env "$job" "$rpc_env")"
    done <<< "$EVM_RPC_URL_ENVS"
done

if [ "$failures" -gt 0 ]; then
    echo "${failures} case(s) failed"
    exit 1
fi
