#!/usr/bin/env bash
set -euo pipefail

# tools/release-changelog-cap.sh
# Reads a changelog on stdin, writes one that fits a Slack section block.
#
# Slack caps a section block's `text` at 3000 characters and rejects the entire
# payload with `invalid_attachments` past it — the card does not degrade, it
# simply never arrives. Nightlies diff against last night and stay small; an RC
# diffs against last week's RC and overflows (v7.0.2-rc.1 composed to 3105).
#
# The per-section entry cap in release-changelog.sh is not a substitute: it
# bounds how many entries appear, not how long they are, and one verbose commit
# subject can carry a seven-entry section past the limit on its own.
#
# Must run BEFORE the caller's `jq -Rs` escape. Cutting already-escaped text can
# split a \n or \" in half and produce invalid JSON.
#
# Usage: printf '%s' "$CHANGELOG" | tools/release-changelog-cap.sh [budget]

BUDGET="${1:-2500}"
MARKER="- ...truncated, see the full changelog linked below"

INPUT=$(cat)

if [ "${#INPUT}" -le "$BUDGET" ]; then
  printf '%s' "$INPUT"
  exit 0
fi

# Whole lines only: a mid-line cut can bisect a `<url|>` link, which
# Slack renders as raw garbage rather than dropping.
LIMIT=$((BUDGET - ${#MARKER} - 1))
OUT=""
while IFS= read -r line; do
  candidate="${OUT}${line}"$'\n'
  if [ "${#candidate}" -gt "$LIMIT" ]; then
    break
  fi
  OUT="$candidate"
done <<<"$INPUT"

printf '%s%s' "$OUT" "$MARKER"
