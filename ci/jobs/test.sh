#!/usr/bin/env bash
set -euxo pipefail

source ci/jobs/lib/toolchain.sh
use_pinned_node
install_pinned_pnpm

./tools/dev/validate-env.sh
pnpm install --frozen-lockfile --prefer-offline
APP_ENV="${ENVIRONMENT:-development}" pnpm run generate:config

# The root `test` script, unrolled so the run can be capped. GitHub splits the
# suite over six 4-core runners; here it is one host, and uncapped turbo (10
# tasks) × vitest (cpu_count - 1 workers each) starved it until files timed
# out while loading. 2 tasks × 3 workers keeps it to about six at a time.
bash tools/dev/rebuild-native.sh
bash tools/dev/generate-config.sh
VITEST_MAX_WORKERS=3 pnpm exec turbo run test --concurrency=2
VITEST_MAX_WORKERS=3 pnpm run test:lanekeep
