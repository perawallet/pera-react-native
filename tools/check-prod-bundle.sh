#!/bin/sh
# Fails CI if test-only modules leak into the production package builds.
#
# What this catches: a production code path inside a package's `dist/` tree
# that ends up importing a test-only npm dependency (msw, vitest,
# @testing-library, etc.). Those imports should never appear because no
# production source file should reference them — if one does, the package
# ships the test surface to downstream consumers and pulls heavy test deps
# into the app bundle.
#
# What this does NOT catch:
# - `dist/test-utils/**` directories — some packages (shared, database,
#   platform) intentionally expose test helpers via a `./test-utils`
#   sub-export. Those are public-by-design even though their consumers are
#   only tests.
# - Source files that have test-only suffixes but no test-only imports.
#   Each package's `tsconfig.build.json` excludes those from declaration
#   emit (`**/{handlers,*-handlers}.ts`); this script is the runtime fallback
#   for cases those excludes miss.
#
# Run after `pnpm build`.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXIT_CODE=0

echo "Checking for test-only module leaks in package dist/ trees..."

# Module imports that should never appear in a production dist:
#   - msw / @mswjs           — REST mocking library
#   - vitest                 — test runner (assertions, hooks, etc.)
#   - @testing-library/*     — DOM/RN testing helpers
#   - @vitest/*              — vitest plugins (coverage, ui, etc.)
# Both ESM (`from 'X'`) and CJS (`require('X')`) shapes are checked. The
# regex deliberately requires a quote boundary on the right (`'` or `"`)
# so partial matches like `mswjs-extra` don't get falsely flagged.
PATTERNS='from [\"'\''](msw|@mswjs/|vitest|@vitest/|@testing-library/)'\
'|require\([\"'\''](msw|@mswjs/|vitest|@vitest/|@testing-library/)'

# Search every shipped dist/ under packages and extensions.
for dist in "$REPO_ROOT"/packages/*/dist "$REPO_ROOT"/extensions/*/dist; do
    [ -d "$dist" ] || continue
    if matches=$(grep -rE "$PATTERNS" "$dist" 2>/dev/null); then
        echo "ERROR: test-only module imported in production bundle: $dist"
        echo "$matches" | head -5
        echo "---"
        EXIT_CODE=1
    fi
done

if [ $EXIT_CODE -eq 0 ]; then
    echo "OK — no test-only module leaks detected."
fi

exit $EXIT_CODE
