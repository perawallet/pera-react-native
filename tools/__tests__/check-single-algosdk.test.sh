#!/usr/bin/env bash
set -uo pipefail

# Pins check-single-algosdk.mjs, the gate standing between a lockfile drift and
# a silent loss of post-quantum signing. The failure it exists to catch is a
# FALSE PASS, which no amount of running it against this repo's own healthy
# lockfile can demonstrate — so every case here drives it against a synthetic
# workspace whose resolution is deliberately wrong.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/check-single-algosdk.mjs"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/tools"
cp "$SCRIPT" "$WORK/tools/check-single-algosdk.mjs"

failures=0

# $1 label  $2 expected exit (0 pass / 1 fail)  $3 catalog range  $4 lock body
# $5 (optional) overrides block, inserted verbatim
run_case() {
    local label="$1" want="$2" range="$3" lock="$4" overrides="${5:-}"
    {
        echo "catalog:"
        echo "  algosdk: ${range}"
        echo ""
        echo "minimumReleaseAge: 10080"
        if [ -n "$overrides" ]; then
            echo ""
            printf '%s\n' "$overrides"
        fi
    } > "$WORK/pnpm-workspace.yaml"
    printf '%s\n' "$lock" > "$WORK/pnpm-lock.yaml"

    local output status
    output=$(node "$WORK/tools/check-single-algosdk.mjs" 2>&1)
    status=$?
    if [ "$status" -eq "$want" ]; then
        echo "  ok    ${label}"
    else
        echo "  FAIL  ${label}: expected exit ${want}, got ${status}"
        echo "        ${output}"
        failures=$((failures + 1))
    fi
}

# One importer resolving algosdk at $1, plus an algokit-utils peer suffix.
lock_with() {
    cat <<EOF
lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      algosdk:
        specifier: 'catalog:'
        version: $1
      '@algorandfoundation/algokit-utils':
        specifier: 'catalog:'
        version: 9.2.0(algosdk@$1)

packages: {}
EOF
}

echo "── the PQ floor"
run_case "official 3.7.0 satisfies ^3.7.0" 0 "^3.7.0" "$(lock_with 3.7.0)"
run_case "a later patch satisfies ^3.7.0" 0 "^3.7.0" "$(lock_with 3.7.4)"
run_case "3.6.0 is rejected — resolves and type-checks but cannot sign quantum" \
    1 "^3.7.0" "$(lock_with 3.6.0)"
run_case "a next major is rejected" 1 "^3.7.0" "$(lock_with 4.0.0)"
run_case "a prerelease is rejected against a stable range" \
    1 "^3.7.0" "$(lock_with 3.7.0-beta.1)"

echo "── non-registry builds"
run_case "a vendored file: tarball is rejected when no override declares it" \
    1 "^3.7.0" "$(lock_with 'file:libs/algosdk-3.7.0-beta.1.tgz')"
run_case "an npm: alias to a fork is rejected" \
    1 "^3.7.0" "$(lock_with '@joe-p/algosdk@3.7.0-beta.1')"

echo "── two copies (the PERA-4653 incident)"
run_case "two distinct resolutions fail" 1 "^3.7.0" "$(cat <<'EOF'
lockfileVersion: '9.0'

importers:

  packages/blockchain:
    dependencies:
      algosdk:
        specifier: 'catalog:'
        version: 3.7.0

  packages/signing:
    dependencies:
      algosdk:
        specifier: 'catalog:'
        version: 3.6.0

packages: {}
EOF
)"

echo "── override handling"
run_case "an override that matches the resolution passes" 0 "^3.7.0" \
    "$(lock_with 3.7.0)" "$(printf 'overrides:\n  algosdk: 3.7.0\n')"
# Regression: the block was once read with an indentation-anchored regex, which
# stopped at the first blank line. An override declared below one was invisible,
# so "declared but not taking effect" passed silently.
run_case "an override below a blank line is still seen (not silently skipped)" 1 "^3.7.0" \
    "$(lock_with 3.7.0)" \
    "$(printf 'overrides:\n  # a comment\n\n  algosdk: file:./libs/algosdk-3.7.0-beta.1.tgz\n')"

echo "── catalog range syntax"
run_case "an exact catalog pin matching the resolution passes" 0 "3.7.0" "$(lock_with 3.7.0)"
run_case "an exact catalog pin not matching the resolution fails" 1 "3.7.0" "$(lock_with 3.7.4)"
run_case "a range syntax the gate cannot read fails loudly" 1 ">=3.7.0" "$(lock_with 3.7.0)"

echo "── parsing robustness"
run_case "a peer suffix on the resolved version is not mistaken for a fork" \
    0 "^3.7.0" "$(lock_with '3.7.0(typescript@5.9.3)')"
# Not expressible through run_case, which always writes an algosdk catalog line.
printf 'catalog:\n  zustand: ^5.0.12\n' > "$WORK/pnpm-workspace.yaml"
lock_with 3.7.0 > "$WORK/pnpm-lock.yaml"
if node "$WORK/tools/check-single-algosdk.mjs" >/dev/null 2>&1; then
    echo "  FAIL  a catalog with no algosdk entry passes vacuously"
    failures=$((failures + 1))
else
    echo "  ok    a catalog with no algosdk entry fails rather than passing vacuously"
fi

if [ "$failures" -gt 0 ]; then
    echo "check-single-algosdk: ${failures} failure(s)"
    exit 1
fi
echo "check-single-algosdk: all checks passed"
