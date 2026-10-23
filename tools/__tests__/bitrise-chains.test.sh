#!/usr/bin/env bash
set -uo pipefail

# Which chains a channel ships is decided by the CHAINS each Bitrise workflow
# and pera-ci job sets, so a dropped or widened entry here silently changes
# what testers or store users get.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BITRISE_YML="$ROOT_DIR/.bitrise/bitrise.yml"
PIPELINES_YML="$ROOT_DIR/ci/pipelines.yml"

failures=0

# The Pera services the staging backend serves for every EVM network; change
# them only with the backend.
EVM_STAGING_SERVICES="prices,assets,history,blockFollowing"

# Every EVM chain and network, from the table generate-config.sh bakes from.
EVM_CONFIG="$(node "$ROOT_DIR/tools/dev/evm-config-keys.cjs")"
EVM_CHAIN_IDS="$(awk '$1 == "chain" { print $2 }' <<< "$EVM_CONFIG")"
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
    # A pera-ci job sees only its declared env, so an unset CHAINS there is the
    # config default, Algorand alone. Bitrise must pin it against an app-level CHAINS.
    production_unset_chains=""
    [ "$source" = pipelines ] && production_unset_chains="algorand"

    echo "${source} chain env"
    check "the parser finds a job's envs" "staging" "$("$env_of" ios-staging APP_ENV)"

    for job in ios-staging android-staging web-staging; do
        check "${job} ships every chain" \
            "$(sorted_csv "algorand,$(paste -sd, - <<< "$EVM_CHAIN_IDS")")" \
            "$(sorted_csv "$("$env_of" "$job" CHAINS)")"
        while read -r rpc_env services_env; do
            url="$("$env_of" "$job" "$rpc_env")"
            check "${job} sets an https ${rpc_env}" "yes" \
                "$([[ "$url" == https://?* ]] && echo yes || echo "no (${url})")"
            check "${job} lists the ${services_env}" \
                "$EVM_STAGING_SERVICES" "$("$env_of" "$job" "$services_env")"
        done <<< "$EVM_SCOPE_ENVS"
    done

    for job in ios-production android-production web-production; do
        chains="$("$env_of" "$job" CHAINS)"
        check "${job} ships Algorand alone" \
            "algorand" "$(sorted_csv "${chains:-$production_unset_chains}")"
        while read -r rpc_env services_env; do
            for key in "$rpc_env" "$services_env"; do
                check "${job} sets no ${key}" "" "$("$env_of" "$job" "$key")"
            done
        done <<< "$EVM_SCOPE_ENVS"
    done
done

if [ "$failures" -gt 0 ]; then
    echo "${failures} case(s) failed"
    exit 1
fi
