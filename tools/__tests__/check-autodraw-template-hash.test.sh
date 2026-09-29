#!/usr/bin/env bash
set -uo pipefail

# Pins check-autodraw-template-hash.mjs, the build gate between a changed
# AutoDraw TEAL template and a release whose Bitrise pin no longer matches it.
# Every case drives the script against a synthetic workspace so the failing
# paths (mismatch, unpinned release build) can actually be exercised.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/check-autodraw-template-hash.mjs"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/tools" "$WORK/packages/chain-algorand/src/card/escrow" "$WORK/packages/config/src"
cp "$SCRIPT" "$WORK/tools/check-autodraw-template-hash.mjs"

NODE=(node --experimental-strip-types --disable-warning=ExperimentalWarning)

failures=0
check() { # $1 label  $2 expected  $3 actual
    if [ "$2" = "$3" ]; then
        echo "  ok    $1"
    else
        echo "  FAIL  $1: expected '$2', got '$3'"
        failures=$((failures + 1))
    fi
}

TEMPLATE=$'#pragma version 13\nintcblock 1 6 TMPL_KILLSWITCH_APP TMPL_MAIN_APP\nbytecblock TMPL_GENESIS_HASH\nintc_0\nreturn\n'
cat >"$WORK/packages/chain-algorand/src/card/escrow/autodraw-teal.ts" <<TS
export const TMPL_KILLSWITCH_APP = 'TMPL_KILLSWITCH_APP'
export const TMPL_MAIN_APP = 'TMPL_MAIN_APP'
export const TMPL_GENESIS_HASH = 'TMPL_GENESIS_HASH'
export const AUTODRAW_TEAL_TEMPLATE = \`${TEMPLATE}\`
TS

if command -v sha256sum >/dev/null 2>&1; then
    GOOD=$(printf '%s' "$TEMPLATE" | sha256sum | cut -d' ' -f1)
else
    GOOD=$(printf '%s' "$TEMPLATE" | shasum -a 256 | cut -d' ' -f1)
fi

write_env() { # $1 body of the generated env object (may be empty)
    cat >"$WORK/packages/config/src/generated-env.ts" <<TS
export const generatedEnv = {
$1
} as const;
TS
}

OUT_FILE="$WORK/out.log"
run() { # prints the exit status; output lands in $OUT_FILE (run is called in a subshell)
    "${NODE[@]}" "$WORK/tools/check-autodraw-template-hash.mjs" "$@" >"$OUT_FILE" 2>&1
    echo $?
}
contains() { # $1 label  $2 needle
    if grep -q -F -- "$2" "$OUT_FILE"; then
        check "$1" 1 1
    else
        check "$1" 1 0
    fi
}

write_env "  cardAutoDrawTemplateHash: \"$GOOD\","
check "matching pin passes" 0 "$(run)"

write_env "  cardAutoDrawTemplateHash: \"  $(printf '%s' "$GOOD" | tr 'a-f' 'A-F')  \","
check "upper-case padded pin passes" 0 "$(run)"

write_env "  cardAutoDrawTemplateHash: \"0000000000000000000000000000000000000000000000000000000000000000\","
check "mismatched pin fails" 1 "$(run)"
contains "mismatch prints the actual hash" "$GOOD"

write_env ""
check "empty pin passes in development" 0 "$(run)"
contains "empty pin warns in development" "WARN"

write_env "  appEnvironment: \"staging\","
check "empty pin fails in staging" 1 "$(run)"

write_env "  appEnvironment: \"production\","
check "empty pin fails in production" 1 "$(run)"

write_env ""
check "--print exits 0 without a pin" 0 "$(run --print)"
contains "--print shows the template hash" "$GOOD"

rm "$WORK/packages/config/src/generated-env.ts"
check "missing generated config fails" 1 "$(run)"

if [ "$failures" -gt 0 ]; then
    echo "$failures failure(s)"
    exit 1
fi
echo "all cases passed"
