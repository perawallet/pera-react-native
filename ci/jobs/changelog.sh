#!/usr/bin/env bash
set -euxo pipefail

# The range has to be per-channel: alpha and rc tags interleave on main, so
# "since the previous tag of any shape" is the wrong diff, and with no base at
# all generate_changelog.sh falls back to the repository's first commit and
# reports the whole of history. release-range-start.sh is the shared rule; it
# prints nothing when there is genuinely no predecessor.
BASE=$(./tools/release-range-start.sh "$CI_TAG")

CHANGELOG=$(./tools/generate_changelog.sh "$BASE")
{
  echo "text<<PERA_CI_EOF"
  echo "$CHANGELOG"
  echo "PERA_CI_EOF"
} >> "$CI_OUTPUT"
