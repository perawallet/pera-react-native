#!/usr/bin/env bash
set -uo pipefail

# tools/qa-smoke-verdict.sh <results-dir>
# Prints `ok` or `fail` for a finished Robot run, and exits 0/1 to match.
#
# Exists because the BrowserStack SDK's exit code is not evidence: a run that
# reported "1 test, 0 passed, 1 failed" and then crashed pabot's result merge
# still exited 0, so the gate reported a pass for a build that never reached
# the home screen. The artefacts are the only honest source.
#
# Deliberately reads the XML with grep rather than calling `rebot`: this runs
# from the Bitrise publish step too, which is a separate shell with no harness
# venv on PATH.

RESULTS_DIR="${1:?results dir required}"

# The merged file when pabot managed to write one, otherwise the per-process
# outputs — the observed failure left results ONLY in pabot_results/0/, so a
# top-level-only check reports a pass on a run that failed. Never both: the
# merged file already contains the others, and summing would double-count.
OUTPUTS=()
if [ -f "$RESULTS_DIR/output.xml" ]; then
    OUTPUTS=("$RESULTS_DIR/output.xml")
elif [ -d "$RESULTS_DIR/pabot_results" ]; then
    while IFS= read -r f; do
        [ -n "$f" ] && OUTPUTS+=("$f")
    done < <(find "$RESULTS_DIR/pabot_results" -name output.xml 2>/dev/null | sort)
fi

# No results at all is a failure, not an absence of news: a run that died
# before writing one told us nothing about the build.
if [ "${#OUTPUTS[@]}" -eq 0 ]; then
    echo "fail"
    exit 1
fi

total_pass=0
total_fail=0
for f in "${OUTPUTS[@]}"; do
    # Robot records the run's tally in <statistics><total><stat .../></total>.
    # Flatten first: the element is routinely split across lines.
    block=$(tr '\n' ' ' <"$f" | sed -n 's#.*<total>\(.*\)</total>.*#\1#p')
    if [ -z "$block" ]; then
        # Truncated or unparseable output — the run did not finish cleanly.
        echo "fail"
        exit 1
    fi
    p=$(printf '%s' "$block" | grep -o 'pass="[0-9]*"' | head -1 | tr -dc '0-9')
    q=$(printf '%s' "$block" | grep -o 'fail="[0-9]*"' | head -1 | tr -dc '0-9')
    total_pass=$((total_pass + ${p:-0}))
    total_fail=$((total_fail + ${q:-0}))
done

# pass>0 is load-bearing, not belt-and-braces: a `--include` tag that matches
# nothing produces a clean run with zero tests, which is the same silent green
# this script exists to stop.
if [ "$total_fail" -eq 0 ] && [ "$total_pass" -gt 0 ]; then
    echo "ok"
    exit 0
fi

echo "fail"
exit 1
