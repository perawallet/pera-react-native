#!/usr/bin/env bash
# Sourced by the job scripts. Every version comes from the checkout
# (.tool-versions, package.json), never from the daemon: inheriting the
# daemon's Node changes host globals under the test suite. Node >=24 ships an
# inert globalThis.localStorage that makes vitest's jsdom skip installing its
# own, so window.localStorage is undefined and the failure looks unrelated.

use_pinned_node() {
  local version bin active
  version=$(awk '$1 == "nodejs" { print $2 }' .tool-versions)
  if [ -z "$version" ]; then
    echo "pera-ci: no \"nodejs\" line found in .tool-versions" >&2
    return 1
  fi
  # Pathname expansion does not happen in an assignment, so the glob must be
  # resolved by a command first. sort -V picks the newest matching patch.
  bin=$(ls -d "$HOME"/.nvm/versions/node/v"${version}".*/bin | sort -V | tail -1)
  export PATH="$bin:$PATH"
  active=$(node -p "process.versions.node.split('.')[0]")
  if [ "$active" != "$version" ]; then
    echo "pera-ci: Node ${active} is active but .tool-versions pins ${version}" >&2
    return 1
  fi
}

# Unpinned, `npm i -g pnpm` floats to latest, and a pnpm major changes
# lockfile and hoisting behaviour under a release build with no repo change.
# split('+') strips a Corepack hash suffix that npm can't install.
install_pinned_pnpm() {
  local version
  version=$(node -p "require('./package.json').packageManager.split('@')[1].split('+')[0]")
  npm install -g "pnpm@${version}"
}

# Bitrise installs Ruby via asdf from .tool-versions; a workstation may use
# rbenv or mise instead. The pin is exact (unlike Node's major-only one), so no
# glob or sort is needed.
use_pinned_ruby() {
  local version bin
  version=$(awk '$1 == "ruby" { print $2 }' .tool-versions)
  if [ -z "$version" ]; then
    echo "pera-ci: no \"ruby\" line found in .tool-versions" >&2
    return 1
  fi
  for bin in "$HOME/.asdf/installs/ruby/${version}/bin" \
    "$HOME/.rbenv/versions/${version}/bin" \
    "$HOME/.local/share/mise/installs/ruby/${version}/bin"; do
    if [ -x "$bin/ruby" ]; then
      export PATH="$bin:$PATH"
      return 0
    fi
  done
  echo "pera-ci: ruby ${version} is not installed under asdf, rbenv or mise" >&2
  return 1
}

# Mirrors bitrise.yml's "Resolve marketing version" step: the tag is the
# source of truth (strip leading v and any -prerelease suffix), falling back
# to package.json for a non-tag build.
resolve_app_version() {
  if [ -n "${CI_TAG:-}" ]; then
    local version="${CI_TAG#v}"
    echo "${version%%-*}"
  else
    jq -r '.version | split("-")[0]' apps/mobile/package.json
  fi
}

# ccache is optional: a host without it builds exactly as before. The job
# user's PATH may not include Homebrew, and React Native's pod install looks
# ccache up with `command -v`, so a Homebrew install is put on PATH here.
# CCACHE_DIR comes from the daemon (one per pipeline). Every run is a fresh
# checkout at a new path, so without CCACHE_BASEDIR the absolute paths in
# each compile's key would miss the previous run's cache every time.
use_ccache_if_available() {
  local dir
  if ! command -v ccache >/dev/null; then
    for dir in /opt/homebrew/bin /usr/local/bin; do
      if [ -x "$dir/ccache" ]; then
        export PATH="$dir:$PATH"
        break
      fi
    done
  fi
  if ! command -v ccache >/dev/null; then
    echo "pera-ci: ccache not found; compiling without it"
    return 0
  fi
  echo "pera-ci: compiling through $(command -v ccache)"
  export CCACHE_BASEDIR="$CI_WORKSPACE"
  # Release native builds compile with -g, and ccache then hashes the cwd
  # too, which BASEDIR doesn't rewrite: every run missed. Debug-info paths
  # pointing at a deleted checkout are a fair price.
  export CCACHE_NOHASHDIR=1
  # CMake 3.17+ reads these as defaults, so every native module's
  # externalNativeBuild compiles through ccache. NDK_CCACHE covers ndk-build.
  export CMAKE_C_COMPILER_LAUNCHER=ccache
  export CMAKE_CXX_COMPILER_LAUNCHER=ccache
  export NDK_CCACHE=ccache
  # Read by app.config.builder.js to turn on expo-build-properties'
  # ios.ccacheEnabled at prebuild.
  export USE_CCACHE=1
}
