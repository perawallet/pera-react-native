#!/usr/bin/env bash
set -uo pipefail

# Slack rejects a whole payload with `invalid_attachments` when a section
# block's text passes 3000 characters. An RC diffs against last week's RC
# rather than last night's nightly, which is what pushed real cards over:
# v7.0.2-rc.1 composed to 3105. This pins the cap that prevents it.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/cap-changelog.sh"

failures=0
check() { # $1 label  $2 expected  $3 actual
    if [ "$2" = "$3" ]; then
        echo "  ok    $1"
    else
        echo "  FAIL  $1: expected '$2', got '$3'"
        failures=$((failures + 1))
    fi
}

LONG=$(printf '*Bug Fixes:*\n'
    for i in $(seq 1 40); do
        echo "- accounts: a deliberately verbose subject line number ${i} that pads this section well past the slack limit [PERA-${i}]"
    done)

CAPPED=$(printf '%s' "$LONG" | "$SCRIPT" 2500)

check "long input is brought under budget" "yes" \
    "$([ "${#CAPPED}" -le 2500 ] && echo yes || echo no)"

# Guards the checks below from passing vacuously on empty output: a cap that
# threw everything away would satisfy "under budget" and "no partial lines".
check "capped output still fills most of the budget" "yes" \
    "$([ "${#CAPPED}" -ge 2000 ] && echo yes || echo no)"

check "capped output marks the truncation" "yes" \
    "$(printf '%s' "$CAPPED" | tail -1 | grep -q 'truncated' && echo yes || echo no)"

# The failure mode a naive `cut -c` would produce: a half-written entry, or
# worse a half-written `<url|text>` link that renders as garbage in Slack.
partials=0
while IFS= read -r line; do
    case "$line" in
        *truncated* | '*Bug Fixes:*') continue ;;
    esac
    # `--`: every entry starts with "- ", which BSD grep reads as a flag.
    printf '%s' "$LONG" | grep -qxF -- "$line" || partials=$((partials + 1))
done <<<"$CAPPED"
check "every retained line is whole" "0" "$partials"

SHORT=$(printf -- '- one line\n- two line')
check "input already under budget passes through untouched" "$SHORT" \
    "$(printf '%s' "$SHORT" | "$SCRIPT" 2500)"

# The composed section text is what Slack actually measures: the card's
# prefix and the trailing links ride along with the changelog.
PREFIX='*Changes since last build:*'
LINKS=$'\n\n<https://app.bitrise.io/artifact/12345/p/abcdef0123456789|Full changelog>'
COMPOSED="${PREFIX}"$'\n'"${CAPPED}${LINKS}"
check "composed section text clears the 3000 slack limit" "yes" \
    "$([ "${#COMPOSED}" -le 3000 ] && echo yes || echo no)"

check "a budget larger than the input is a no-op" "$SHORT" \
    "$(printf '%s' "$SHORT" | "$SCRIPT" 99999)"

if [ "$failures" -gt 0 ]; then
    echo "changelog-cap: ${failures} failure(s)"
    exit 1
fi
echo "changelog-cap: all checks passed"
