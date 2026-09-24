#!/usr/bin/env bash
set -uo pipefail

# Pins check-layer-tiers.mjs against synthetic workspaces, so each tier rule is
# shown to fail on its own violation rather than only passing on the repo's
# current (healthy) graph.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/check-layer-tiers.mjs"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

failures=0
check() { # $1 label  $2 expected  $3 actual
    if [ "$2" = "$3" ]; then
        echo "  ok    $1"
    else
        echo "  FAIL  $1: expected '$2', got '$3'"
        failures=$((failures + 1))
    fi
}

# $1 root  $2 member dir (e.g. packages/shared)  $3 dependencies JSON  $4 devDependencies JSON
member() {
    local dir="$1/$2" deps="${3:-}" dev_deps="${4:-}"
    [ -n "$deps" ] || deps='{}'
    [ -n "$dev_deps" ] || dev_deps='{}'
    mkdir -p "$dir"
    cat >"$dir/package.json" <<JSON
{
  "name": "@scope/$(basename "$2")",
  "dependencies": $deps,
  "devDependencies": $dev_deps
}
JSON
}

dep() { printf '{"@scope/%s": "workspace:*"}' "$1"; }

# A healthy graph every case below starts from.
baseline() {
    member "$1" packages/config
    member "$1" packages/shared "$(dep config)"
    member "$1" packages/devtools
    member "$1" packages/accounts "$(dep provider)" "$(dep devtools)"
    member "$1" extensions/platform "$(dep shared)" "$(dep devtools)"
    member "$1" extensions/hardware-wallet "$(dep shared)"
    member "$1" extensions/provider \
        '{"@scope/platform": "workspace:*", "@scope/hardware-wallet": "workspace:*"}'
    member "$1" extensions/ledger-shared "$(dep hardware-wallet)"
    member "$1" extensions/ledger-web-ble "$(dep ledger-shared)"
    member "$1" apps/mobile "$(dep ledger-web-ble)"
}

run() { node "$SCRIPT" "$1" >/dev/null 2>&1; echo $?; }

GOOD=$WORK/good
baseline "$GOOD"
check "accepts a graph that respects every tier" "0" "$(run "$GOOD")"

BOTTOM=$WORK/bottom
baseline "$BOTTOM"
member "$BOTTOM" packages/shared "$(dep accounts)"
check "rejects the bottom tier depending on a business package" "1" "$(run "$BOTTOM")"

CONTRACT_PKG=$WORK/contract-pkg
baseline "$CONTRACT_PKG"
member "$CONTRACT_PKG" extensions/platform "$(dep accounts)"
check "rejects the platform contract depending on a business package" "1" "$(run "$CONTRACT_PKG")"

CONTRACT_EXT=$WORK/contract-ext
baseline "$CONTRACT_EXT"
member "$CONTRACT_EXT" extensions/platform "$(dep hardware-wallet)"
check "rejects the platform contract depending on another extension" "1" "$(run "$CONTRACT_EXT")"

EXT_PKG=$WORK/ext-pkg
baseline "$EXT_PKG"
member "$EXT_PKG" extensions/ledger-shared "$(dep accounts)"
check "rejects an extension depending on a business package" "1" "$(run "$EXT_PKG")"

EXT_PKG_DEV=$WORK/ext-pkg-dev
baseline "$EXT_PKG_DEV"
member "$EXT_PKG_DEV" extensions/provider "$(dep platform)" "$(dep accounts)"
check "counts devDependencies too" "1" "$(run "$EXT_PKG_DEV")"

TRANSPORT=$WORK/transport
baseline "$TRANSPORT"
member "$TRANSPORT" extensions/provider "$(dep ledger-web-ble)"
check "rejects the provider depending on a hardware-wallet transport" "1" "$(run "$TRANSPORT")"

TRANSPORT_PKG=$WORK/transport-pkg
baseline "$TRANSPORT_PKG"
member "$TRANSPORT_PKG" packages/accounts "$(dep ledger-web-ble)"
check "rejects a business package depending on a hardware-wallet transport" "1" "$(run "$TRANSPORT_PKG")"

APP=$WORK/app
baseline "$APP"
member "$APP" packages/accounts "$(dep mobile)"
check "rejects a package depending on an app" "1" "$(run "$APP")"

TOOLING=$WORK/tooling
baseline "$TOOLING"
member "$TOOLING" extensions/platform "$(dep devtools)"
check "rejects tooling as a runtime dependency" "1" "$(run "$TOOLING")"

# keystore-chrome -> passkeys is on the script's allowlist.
ALLOWED=$WORK/allowed
baseline "$ALLOWED"
member "$ALLOWED" packages/passkeys
member "$ALLOWED" extensions/keystore-chrome "$(dep passkeys)"
check "accepts an allowlisted edge" "0" "$(run "$ALLOWED")"

STALE=$WORK/stale
baseline "$STALE"
member "$STALE" packages/passkeys
member "$STALE" extensions/keystore-chrome "$(dep platform)"
check "rejects an allowlisted edge that no longer exists" "1" "$(run "$STALE")"

# An empty tree means the globs stopped matching; passing would be a false green.
check "refuses an empty workspace rather than passing" "1" "$(run "$WORK/empty")"

if [ "$failures" -gt 0 ]; then
    echo "check-layer-tiers: ${failures} failure(s)"
    exit 1
fi
echo "check-layer-tiers: all checks passed"
