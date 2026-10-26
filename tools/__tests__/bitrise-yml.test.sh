#!/usr/bin/env bash
set -uo pipefail

# Pins bitrise-yml.sh to the text the bitrise.io editor saves, so a paste there
# diffs only real changes. Runs against a synthetic config, not the repo's own.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/release/bitrise-yml.sh"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
export BITRISE_YML="$WORK/bitrise.yml"

failures=0

check() { # $1 label  $2 expected exit  $3 actual exit
    if [ "$2" = "$3" ]; then
        echo "  ok    $1"
    else
        echo "  FAIL  $1: expected exit $2, got $3"
        failures=$((failures + 1))
    fi
}

cat >"$BITRISE_YML" <<'EOF'
format_version: '13'
# dropped by a dashboard save
app:
    envs:
        - BUNDLE_FROZEN: "true"
EOF

bash "$SCRIPT" --check >/dev/null 2>&1
check "an unsorted, commented, 4-space config fails the check" 1 $?

bash "$SCRIPT" >/dev/null 2>&1
bash "$SCRIPT" --check >/dev/null 2>&1
check "the rewritten config passes the check" 0 $?

expected=$'---\napp:\n  envs:\n  - BUNDLE_FROZEN: \'true\'\nformat_version: \'13\'\n'
if [ "$(cat "$BITRISE_YML"; echo x)" = "${expected}x" ]; then
    echo "  ok    the rewrite is the editor's text"
else
    echo "  FAIL  the rewrite is not the editor's text:"
    cat "$BITRISE_YML"
    failures=$((failures + 1))
fi

[ "$failures" -eq 0 ] || exit 1
