#!/usr/bin/env bash
set -uo pipefail

# The gate reported a pass on a run whose only test failed: the BrowserStack
# SDK exited 0 after pabot's result merge crashed, and nothing read the
# artefacts. These fixtures cover every layout that run can leave behind.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/smoke-verdict.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

failures=0
check() { # $1 label  $2 expected  $3 actual
    if [ "$2" = "$3" ]; then
        echo "  ok    $1"
    else
        echo "  FAIL  $1: expected '$2', got '$3'"
        failures=$((failures + 1))
    fi
}

# Robot's real shape, trimmed to what the verdict reads.
write_output() { # $1 path  $2 pass  $3 fail
    mkdir -p "$(dirname "$1")"
    cat >"$1" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<robot generator="Robot 6.1.1" rpa="false">
<suite id="s1" name="OnboardingTest">
<test id="s1-t1" name="Test app launch and account creation">
<status status="$([ "$3" -gt 0 ] && echo FAIL || echo PASS)"/>
</test>
</suite>
<statistics>
<total>
<stat pass="$2" fail="$3" skip="0">All Tests</stat>
</total>
</statistics>
</robot>
EOF
}

D="$TMP/passing"
write_output "$D/output.xml" 1 0
check "passing top-level output is ok" "ok" "$("$SCRIPT" "$D")"
check "passing run exits zero" "0" "$("$SCRIPT" "$D" >/dev/null; echo $?)"

D="$TMP/failing"
write_output "$D/output.xml" 0 1
check "failing top-level output is fail" "fail" "$("$SCRIPT" "$D")"
check "failing run exits non-zero" "1" "$("$SCRIPT" "$D" >/dev/null; echo $?)"

# The observed regression: pabot's merge blew up, so results existed only
# under pabot_results/0/ and no top-level output.xml was ever written.
D="$TMP/pabot-only"
write_output "$D/pabot_results/0/output.xml" 0 1
check "failing pabot-only output is fail" "fail" "$("$SCRIPT" "$D")"

D="$TMP/pabot-only-pass"
write_output "$D/pabot_results/0/output.xml" 1 0
check "passing pabot-only output is ok" "ok" "$("$SCRIPT" "$D")"

# Merged file plus its per-process sources must not double-count into a
# disagreement with itself.
D="$TMP/both"
write_output "$D/output.xml" 1 0
write_output "$D/pabot_results/0/output.xml" 1 0
check "merged file wins over its pabot sources" "ok" "$("$SCRIPT" "$D")"

D="$TMP/split"
write_output "$D/pabot_results/0/output.xml" 1 0
write_output "$D/pabot_results/1/output.xml" 0 1
check "one failing shard fails the whole run" "fail" "$("$SCRIPT" "$D")"

D="$TMP/missing"
mkdir -p "$D"
check "missing output.xml is fail" "fail" "$("$SCRIPT" "$D")"

# A --include tag matching nothing runs cleanly and reports nothing. That is
# the same silent green the gate exists to prevent.
D="$TMP/zero-tests"
write_output "$D/output.xml" 0 0
check "zero matched tests is fail" "fail" "$("$SCRIPT" "$D")"

D="$TMP/truncated"
mkdir -p "$D"
printf '<?xml version="1.0"?>\n<robot generator="Robot 6.1.1">\n<suite id="s1"' >"$D/output.xml"
check "truncated output is fail" "fail" "$("$SCRIPT" "$D")"

if [ "$failures" -gt 0 ]; then
    echo "smoke-verdict: ${failures} failure(s)"
    exit 1
fi
echo "smoke-verdict: all checks passed"
