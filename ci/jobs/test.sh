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
# out while loading. The total is sized to the host: two cores left for the
# daemon and OS, and no more workers than three quarters of RAM in GB, because
# an 8 GB machine swaps before it runs out of cores. An M1 Air (8 cores, 8 GB)
# gets 6, the 2 tasks × 3 workers that stopped the timeouts there.
# CI_TEST_WORKERS pins the total by hand.
WORKERS_PER_TASK=3
total_workers=${CI_TEST_WORKERS:-$(node -p "Math.max($WORKERS_PER_TASK, Math.min(os.availableParallelism() - 2, Math.floor(os.totalmem() / 2 ** 30 * 0.75)))")}
turbo_concurrency=$((total_workers / WORKERS_PER_TASK))
[ "$turbo_concurrency" -ge 1 ] || turbo_concurrency=1

bash tools/dev/rebuild-native.sh
bash tools/dev/generate-config.sh
VITEST_MAX_WORKERS=$WORKERS_PER_TASK pnpm exec turbo run test --concurrency="$turbo_concurrency"
# A single vitest process, so it can take the whole total.
VITEST_MAX_WORKERS=$total_workers pnpm run test:lanekeep
