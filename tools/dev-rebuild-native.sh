#!/bin/bash

# tools/dev-rebuild-native.sh
# Builds native addons that pnpm skips during `pnpm install` locally.
#
# Why this is needed:
#   better-sqlite3 is a native module and needs a compiled .node binary.
#   On CI it's built during install via the `onlyBuiltDependencies` allowlist
#   in pnpm-workspace.yaml. Locally that allowlist is overridden by a global
#   `ignore-scripts=true` (a common supply-chain-hardening setting in
#   ~/.npmrc), which suppresses ALL install/build scripts — and even
#   `pnpm rebuild`. So the binary never gets produced and the database tests
#   (and mobile integration tests that spin up an in-memory DB) fail to load
#   better-sqlite3.
#
#   This script builds the binary after the fact. It is idempotent and safe
#   to re-run: it no-ops when the binary already loads, so it's cheap to run
#   before every test invocation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Resolve the better-sqlite3 install the database package actually uses, via
# its symlink. This stays correct across version bumps — no hardcoded path.
BSQ_DIR="$ROOT_DIR/packages/database/node_modules/better-sqlite3"

if [ ! -d "$BSQ_DIR" ]; then
  echo "rebuild-native: better-sqlite3 not installed yet — run 'pnpm install' first." >&2
  exit 0
fi

# better-sqlite3 loads its native binding lazily inside the Database
# constructor, so require() alone succeeds even with no binary — instantiate
# a DB to actually exercise the binding.
loadable() { node -e "new (require('$BSQ_DIR'))(':memory:')" >/dev/null 2>&1; }

# Fast path: already loadable → nothing to do.
if loadable; then
  exit 0
fi

# Serialize concurrent builds: turbo runs the database and mobile test tasks
# in parallel, and two prebuild-installs writing the same store dir would
# corrupt it. Whoever wins the lock builds; the rest wait then re-check.
LOCK_DIR="${TMPDIR:-/tmp}/pera-rebuild-native-better-sqlite3.lock"
until mkdir "$LOCK_DIR" 2>/dev/null; do
  loadable && exit 0      # another process finished the build
  sleep 1
done
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

# Re-check under the lock: a prior holder may have built it while we waited.
if loadable; then
  exit 0
fi

echo "rebuild-native: building better-sqlite3 binary (install scripts are disabled locally)…"
(
  cd "$BSQ_DIR"
  # prebuild-install downloads the prebuilt binary for this platform/node
  # version (no compile). node-gyp is the fallback if no prebuilt exists.
  ./node_modules/.bin/prebuild-install || npx --yes node-gyp rebuild --release
)

if loadable; then
  echo "rebuild-native: ✓ better-sqlite3 ready"
else
  echo "rebuild-native: ✗ better-sqlite3 still not loadable after build" >&2
  exit 1
fi
