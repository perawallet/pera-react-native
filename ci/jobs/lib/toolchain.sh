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
