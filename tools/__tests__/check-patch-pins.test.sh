#!/usr/bin/env bash
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARD="$REPO_ROOT/tools/check-patch-pins.mjs"
FAILURES=0

run_case() {
  local name="$1" fixture="$2" expected="$3"
  local tmp; tmp="$(mktemp -d)"
  printf '%s' "$fixture" > "$tmp/pnpm-workspace.yaml"
  node "$GUARD" "$tmp/pnpm-workspace.yaml" >/dev/null 2>&1
  local actual=$?
  if [ "$actual" -eq "$expected" ]; then
    echo "ok - $name"
  else
    echo "FAIL - $name (expected exit $expected, got $actual)"
    FAILURES=$((FAILURES + 1))
  fi
  rm -rf "$tmp"
}

MATCHING='catalog:
  "@algorandfoundation/react-native-passkey-autofill": 1.0.0-canary.26
patchedDependencies:
  "@algorandfoundation/react-native-passkey-autofill@1.0.0-canary.26": patches/x.patch
'

DRIFTED='catalog:
  "@algorandfoundation/react-native-passkey-autofill": 1.0.0-canary.26
patchedDependencies:
  "@algorandfoundation/react-native-passkey-autofill@1.0.0-canary.24": patches/x.patch
'

run_case "matching patch and catalog versions pass" "$MATCHING" 0
run_case "drifted patch version fails" "$DRIFTED" 1

if [ "$FAILURES" -gt 0 ]; then
  echo "$FAILURES failure(s)"
  exit 1
fi
echo "all passed"
