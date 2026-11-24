#!/usr/bin/env bash
set -euo pipefail

# tools/release/bitrise-yml.sh [--check]
# Bitrise runs the config stored on bitrise.io, and its editor saves it as Ruby's
# YAML.dump of the config with every key sorted. Keeping .bitrise/bitrise.yml in
# exactly that text is what lets a paste into the editor diff only the real
# changes. A save there drops YAML comments, so the canonical form has none: put
# rationale inside a step's script instead. The editor also writes an emoji
# outside the Basic Multilingual Plane as the character, where Ruby's emitter
# escapes it (\U0001F680), so those escapes are written back as characters.
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
  data = sorted(YAML.load_file(ARGV[0]))
  out = YAML.dump(data).gsub(/(?<!\\)((?:\\\\)*)\\U(\h{8})/) { $1 + [$2.hex].pack("U") }
  # In a block scalar the backslash is literal, so the rewrite would change the value.
  abort "a literal \\U escape in a block scalar would be rewritten; write the character instead" unless YAML.load(out) == data
  print out
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
