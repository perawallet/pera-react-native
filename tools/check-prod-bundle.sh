#!/bin/sh
# Fails CI if test-only modules leak into the production package builds.
#
# Why this exists: MSW handlers and fixtures live in package source trees
# under names like `handlers.ts` and `test-handlers.ts` so they can be
# co-located with the API client they mock. They are NOT exported from the
# main barrel, so the vite/Metro bundler never reaches them — but a regression
# (e.g. someone adds `export * from './api/currencies/handlers'` to
# `src/index.ts`) would silently bundle msw into the prod tree.
#
# This script greps every package's `dist/` tree for `msw` imports and fails
# if any are found. Run after `pnpm build`.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXIT_CODE=0

echo "Checking for test-only module leaks in package dist/ trees..."

# Patterns that indicate msw or other test-only modules made it into prod.
# Tweak when adding new test-only deps.
PATTERNS='from .msw|require.[\"'\'']msw[\"'\'']'

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
