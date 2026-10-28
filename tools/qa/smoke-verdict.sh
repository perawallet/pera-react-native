#!/usr/bin/env bash
set -uo pipefail

# tools/qa/smoke-verdict.sh <results-dir>
# Prints `ok` or `fail` for a finished Robot run, and exits 0/1 to match.
#
# Exists because the BrowserStack SDK's exit code is not evidence: a run that
# reported "1 test, 0 passed, 1 failed" and then crashed pabot's result merge
# still exited 0, so the gate reported a pass for a build that never reached
# the home screen. The artefacts are the only honest source.
#
# Uses the system Python standard library: the Bitrise publish step has no harness
# venv on PATH. Parse the complete XML so truncated output cannot look like a pass.

RESULTS_DIR="${1:?results dir required}"
if [ -e "$RESULTS_DIR/.incomplete" ]; then
    echo "fail"
    exit 1
fi

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

python3 - "${OUTPUTS[@]}" <<'PYTHON'
import sys
import xml.etree.ElementTree as ET

try:
    passed = failed = 0
    for path in sys.argv[1:]:
        root = ET.parse(path).getroot()
        if root.tag != "robot":
            raise ValueError("Not Robot output")
        totals = root.findall("./statistics/total/stat")
        if len(totals) != 1:
            raise ValueError("Missing or ambiguous totals")
        values = [totals[0].get(key, "") for key in ("pass", "fail", "skip")]
        if not all(value.isascii() and value.isdecimal() for value in values):
            raise ValueError("Invalid totals")
        passed += int(values[0])
        failed += int(values[1])
    ok = passed > 0 and failed == 0
except (OSError, ET.ParseError, ValueError):
    ok = False
print("ok" if ok else "fail")
sys.exit(0 if ok else 1)
PYTHON
