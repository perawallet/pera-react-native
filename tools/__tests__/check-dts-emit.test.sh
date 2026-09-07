#!/usr/bin/env bash
set -uo pipefail

# Pins check-dts-emit.mjs, the guard standing between a package's published
# `exports` and an empty `dist/*.d.ts`. Both failures it catches are silent —
# a missing build config ships an untyped import, and a brace glob in `exclude`
# is ignored by tsconfig rather than rejected — so every case here drives it
# against a synthetic workspace, not the repo's own (currently healthy) one.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/check-dts-emit.mjs"
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

# $1 root  $2 package name  $3 build script  $4 exclude JSON  $5 extra tsconfig keys
make_pkg() {
    local dir="$1/packages/$2"
    mkdir -p "$dir"
    printf '%s\n' "export default {}" >"$dir/vite.config.ts"
    cat >"$dir/package.json" <<JSON
{
  "name": "@scope/$2",
  "scripts": { "build": "$3" },
  "exports": { ".": { "types": "./dist/index.d.ts" } }
}
JSON
    if [ "$4" != "none" ]; then
        cat >"$dir/tsconfig.build.json" <<JSON
{
  "compilerOptions": { $5 "rootDir": "./src", "outDir": "./dist" },
  "exclude": $4
}
JSON
    fi
}

run() { node "$SCRIPT" "$1" >/dev/null 2>&1; echo $?; }

GOOD=$WORK/good
make_pkg "$GOOD" ok "vite build && tsc -p tsconfig.build.json" '["**/handlers.ts","**/*-handlers.ts"]' ""
check "accepts a correctly wired package" "0" "$(run "$GOOD")"

BRACE=$WORK/brace
make_pkg "$BRACE" braced "vite build && tsc -p tsconfig.build.json" '["**/{handlers,*-handlers}.ts"]' ""
check "rejects a brace glob tsconfig would ignore" "1" "$(run "$BRACE")"

NOCFG=$WORK/nocfg
make_pkg "$NOCFG" bare "vite build && tsc -p tsconfig.build.json" none ""
check "rejects a publishing package with no build config" "1" "$(run "$NOCFG")"

NOTSC=$WORK/notsc
make_pkg "$NOTSC" plain "vite build" '["**/handlers.ts"]' ""
check "rejects a build script that never runs tsc" "1" "$(run "$NOTSC")"

NOROOT=$WORK/noroot
mkdir -p "$NOROOT/packages/rootless"
printf '%s\n' "export default {}" >"$NOROOT/packages/rootless/vite.config.ts"
cat >"$NOROOT/packages/rootless/package.json" <<'JSON'
{
  "name": "@scope/rootless",
  "scripts": { "build": "vite build && tsc -p tsconfig.build.json" },
  "exports": { ".": { "types": "./dist/index.d.ts" } }
}
JSON
printf '%s\n' '{ "compilerOptions": { "outDir": "./dist" }, "exclude": [] }' \
    >"$NOROOT/packages/rootless/tsconfig.build.json"
check "rejects a build config with no rootDir" "1" "$(run "$NOROOT")"

# A package that ships no declarations is not this guard's business.
SKIP=$WORK/skip
mkdir -p "$SKIP/packages/app"
printf '%s\n' "export default {}" >"$SKIP/packages/app/vite.config.ts"
printf '%s\n' '{ "name": "@scope/app", "scripts": { "build": "vite build" } }' \
    >"$SKIP/packages/app/package.json"
make_pkg "$SKIP" lib "vite build && tsc -p tsconfig.build.json" '["**/handlers.ts"]' ""
check "ignores a package that publishes no declarations" "0" "$(run "$SKIP")"

# An empty tree means the globs stopped matching; passing would be a false green.
check "refuses an empty workspace rather than passing" "1" "$(run "$WORK/empty")"

if [ "$failures" -gt 0 ]; then
    echo "check-dts-emit: ${failures} failure(s)"
    exit 1
fi
echo "check-dts-emit: all checks passed"
