#!/usr/bin/env bash
set -uo pipefail

# Pins the doc-hygiene split: the script owns Markdown, shell and YAML, while
# code comments belong to pera/no-work-item-refs. A gitignored path is
# generated, so naming one is not a stale reference.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/check-doc-hygiene.mjs"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

failures=0
check() { # $1 label  $2 expected  $3 actual
    if [ "$2" = "$3" ]; then
        echo "  ok    $1"
    else
        echo "  FAIL  $1: expected '$2', got '$3'"
        failures=$((failures + 1))
    fi
}

git -C "$WORK" init -q
mkdir -p "$WORK/docs" "$WORK/tools" "$WORK/packages/config/src"
printf '%s\n' 'Tracked in PERA-12.' >"$WORK/docs/ref.md"
printf '%s\n' '// Tracked in PERA-12.' 'export const x = 1' >"$WORK/tools/code.ts"
printf '%s\n' '# Tracked in PERA-12.' 'echo hi' >"$WORK/tools/run.sh"
printf '%s\n' 'Reads `packages/config/src/generated-env.ts` at build time.' >"$WORK/docs/generated.md"
printf '%s\n' 'Reads `packages/config/src/gone.ts`.' >"$WORK/docs/stale.md"
printf '%s\n' 'packages/config/src/generated-env.ts' >"$WORK/.gitignore"
printf '%s\n' '# Tracked in PERA-12.' 'a: 1' >"$WORK/conf.yaml"
git -C "$WORK" add -A

OUT=$(DOC_HYGIENE_ROOT="$WORK" node "$SCRIPT" --json --warn-only)
count() { # $1 rule  $2 file
    printf '%s' "$OUT" | node -e "const f=JSON.parse(require('fs').readFileSync(0,'utf8')).findings;console.log(f.filter(x=>x.rule==='$1'&&x.file==='$2').length)"
}

check "Markdown work-item reference" 1 "$(count no-work-item-refs docs/ref.md)"
check "shell comment work-item reference" 1 "$(count no-work-item-refs tools/run.sh)"
check "YAML comment work-item reference" 1 "$(count no-work-item-refs conf.yaml)"
check "code comment left to lanekeep" 0 "$(count no-work-item-refs tools/code.ts)"
check "gitignored path is not stale" 0 "$(count stale-path docs/generated.md)"
check "missing path is stale" 1 "$(count stale-path docs/stale.md)"

[ "$failures" -eq 0 ] || exit 1
