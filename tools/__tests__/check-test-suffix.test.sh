#!/usr/bin/env bash
set -uo pipefail

# Pins check-test-suffix.mjs: it must reject every JS/TS `.test.` file and leave
# the suffixes that are legitimately not vitest `.spec` files alone (shell
# suites, Playwright specs, source that merely contains "test" in its name).

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/check-test-suffix.mjs"

failures=0

# $1 label  $2 expected exit (0 pass / 1 fail)  $3.. paths to check
run_case() {
    local label="$1" want="$2"
    shift 2

    local output status
    output=$(node "$SCRIPT" "$@" 2>&1)
    status=$?
    if [ "$status" -eq "$want" ]; then
        echo "  ok    ${label}"
    else
        echo "  FAIL  ${label}: expected exit ${want}, got ${status}"
        echo "        ${output}"
        failures=$((failures + 1))
    fi
}

echo "── rejects the .test suffix"
run_case ".test.ts fails" 1 "packages/x/src/__tests__/a.test.ts"
run_case ".test.tsx fails" 1 "apps/mobile/src/__integration__/flow.test.tsx"
run_case ".test.js fails" 1 "apps/browser/web-shims/__tests__/a.test.js"
run_case ".test.mts fails" 1 "packages/x/src/__tests__/a.test.mts"
run_case "one offender among specs fails" 1 "a.spec.ts" "b.test.ts" "c.spec.tsx"

echo "── leaves other suffixes alone"
run_case ".spec.ts and .spec.tsx pass" 0 "a.spec.ts" "b.spec.tsx"
run_case "shell suites pass" 0 "tools/__tests__/jira-sync.test.sh"
run_case "Playwright specs pass" 0 "apps/browser/e2e/deeplinks.spec.ts"
run_case "names merely containing test pass" 0 "src/test-utils/render.tsx" "src/latest.ts" "src/test.ts"

if [ "$failures" -gt 0 ]; then
    echo "${failures} case(s) failed"
    exit 1
fi
echo "all cases passed"
