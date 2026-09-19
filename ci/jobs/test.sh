#!/usr/bin/env bash
set -euxo pipefail

# Node comes from .tool-versions, never from the daemon. Node >=24 ships an
# inert globalThis.localStorage that makes vitest's jsdom skip installing its
# own, so window.localStorage is undefined and the failure looks unrelated.
NODE_VERSION=$(awk '$1 == "nodejs" { print $2 }' .tool-versions)
if [ -z "$NODE_VERSION" ]; then
  echo "pera-ci: no \"nodejs\" line found in .tool-versions" >&2
  exit 1
fi
# Pathname expansion does not happen in an assignment, so the glob must be
# resolved by a command first. sort -V picks the newest matching patch.
NODE_BIN=$(ls -d "$HOME"/.nvm/versions/node/v"${NODE_VERSION}".*/bin | sort -V | tail -1)
export PATH="$NODE_BIN:$PATH"
ACTIVE=$(node -p "process.versions.node.split('.')[0]")
if [ "$ACTIVE" != "$NODE_VERSION" ]; then
  echo "Node ${ACTIVE} is active but .tool-versions pins ${NODE_VERSION}" >&2
  exit 1
fi

PNPM_VERSION=$(node -p "require('./package.json').packageManager.split('@')[1].split('+')[0]")
npm install -g "pnpm@${PNPM_VERSION}"

./tools/validate-env.sh
pnpm install --frozen-lockfile --prefer-offline
APP_ENV="${ENVIRONMENT:-development}" pnpm run generate:config
pnpm run test
