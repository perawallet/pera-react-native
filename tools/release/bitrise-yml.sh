#!/usr/bin/env bash
set -euo pipefail

# tools/release/bitrise-yml.sh [--check]
# Bitrise runs the config stored on bitrise.io, and its editor saves it as Ruby's
# YAML.dump of the config with every key sorted. Keeping .bitrise/bitrise.yml in
# exactly that text is what lets a paste into the editor diff only the real
# changes. A save there drops YAML comments, so the canonical form has none: put
# rationale inside a step's script instead.
#
# Rewrites the file in place; with --check, fails instead when it differs.

FILE="${BITRISE_YML:-$(git rev-parse --show-toplevel)/.bitrise/bitrise.yml}"
CANONICAL="$(mktemp)"
trap 'rm -f "$CANONICAL"' EXIT

ruby -ryaml -e '
  def sorted(node)
    case node
    when Hash then node.keys.sort.each_with_object({}) { |key, out| out[key] = sorted(node[key]) }
    when Array then node.map { |item| sorted(item) }
    else node
    end
  end
  print YAML.dump(sorted(YAML.load_file(ARGV[0])))
' "$FILE" >"$CANONICAL"

if [ "${1:-}" = "--check" ]; then
  if ! cmp -s "$FILE" "$CANONICAL"; then
    diff -u "$FILE" "$CANONICAL" | head -40 || true
    echo "" >&2
    echo ".bitrise/bitrise.yml is not in the form bitrise.io saves; run 'pnpm format:bitrise'." >&2
    echo "A removed '#' line is a YAML comment the dashboard would drop: move it into a script." >&2
    exit 1
  fi
  echo ".bitrise/bitrise.yml matches the bitrise.io editor format"
  exit 0
fi

cp "$CANONICAL" "$FILE"
