#!/usr/bin/env bash
set -euxo pipefail

source ci/jobs/lib/toolchain.sh
use_pinned_node
install_pinned_pnpm

./tools/validate-env.sh
pnpm install --frozen-lockfile --prefer-offline
APP_ENV="${ENVIRONMENT:-development}" pnpm run generate:config
pnpm run test
