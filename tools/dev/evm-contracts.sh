#!/usr/bin/env bash
# tools/dev/evm-contracts.sh
# Build the Solidity fixtures of the EVM conformance suite with the pinned
# Foundry image and extract { abi, bytecode } per contract into artifacts/.
# `check` rebuilds into a temp dir and fails when the committed artifacts drift.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "${SCRIPT_DIR}/../../conformance-evm/contracts" && pwd)"
FOUNDRY_IMAGE="ghcr.io/foundry-rs/foundry:v1.5.1@sha256:3a70bfa9bd2c732a767bb60d12c8770b40e8f9b6cca28efc4b12b1be81c7f28e"

usage() {
  cat >&2 <<EOF2
Usage: tools/dev/evm-contracts.sh <command>

Commands:
  build    Compile the fixtures and rewrite conformance-evm/contracts/artifacts
  check    Fail when the committed artifacts differ from a fresh build
EOF2
  exit 1
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker not found. Install Docker Desktop: https://docs.docker.com/get-docker/" >&2
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker daemon is not running. Start Docker and retry." >&2
    exit 1
  fi
}

# $1 = directory to write artifacts into
build_into() {
  local dest="$1" work
  # Under the repo, not /tmp: VM-backed Docker (Colima) only mounts the home tree.
  mkdir -p "${CONTRACTS_DIR}/.build"
  work="$(mktemp -d "${CONTRACTS_DIR}/.build/XXXXXX")"
  # Compile a copy so forge's out/ and cache/ never land in the source tree.
  mkdir -p "${work}/src"
  cp "${CONTRACTS_DIR}/foundry.toml" "${work}/"
  cp "${CONTRACTS_DIR}"/src/*.sol "${work}/src/"
  docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
    -v "${work}:/work" -w /work --entrypoint forge "$FOUNDRY_IMAGE" build >&2
  mkdir -p "$dest"
  local sol name
  for sol in "${CONTRACTS_DIR}"/src/*.sol; do
    name="$(basename "$sol" .sol)"
    node -e '
      const [file, out] = process.argv.slice(1)
      const { abi, bytecode } = JSON.parse(require("fs").readFileSync(file, "utf8"))
      require("fs").writeFileSync(out, JSON.stringify({ abi, bytecode: bytecode.object }, null, 2) + "\n")
    ' "${work}/out/${name}.sol/${name}.json" "${dest}/${name}.json"
  done
  rm -rf "$work"
}

trap 'rm -rf "${CONTRACTS_DIR}/.build"' EXIT

cmd="${1:-}"
case "$cmd" in
  build)
    require_docker
    build_into "${CONTRACTS_DIR}/artifacts"
    echo "✓ artifacts written to conformance-evm/contracts/artifacts"
    ;;
  check)
    require_docker
    tmp="$(mktemp -d "${TMPDIR:-/tmp}/evm-contracts.XXXXXX")"
    trap 'rm -rf "$tmp"' EXIT
    build_into "${tmp}/artifacts"
    if ! diff -r "${CONTRACTS_DIR}/artifacts" "${tmp}/artifacts"; then
      echo "ERROR: committed artifacts drift from the Solidity sources. Run: bash tools/dev/evm-contracts.sh build" >&2
      exit 1
    fi
    echo "✓ artifacts match the sources"
    ;;
  *)
    usage
    ;;
esac
