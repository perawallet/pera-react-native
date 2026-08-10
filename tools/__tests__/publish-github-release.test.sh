#!/usr/bin/env bash
set -uo pipefail

# Pins the stable-only rule: nightly and rc tags must never produce a GitHub
# Release, however the script is reached. Runs under DRY_RUN=1, so no gh call and
# no credential is needed — the assertion is whether a create would have run.
# Builds a throwaway repo rather than leaning on this repo's real tags.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/publish-github-release.sh"
REPO=$(mktemp -d)
trap 'rm -rf "$REPO"' EXIT

failures=0

# Output is captured, then substring-matched: piping into `grep -q` under
# pipefail reports 141 when grep exits on an early match and the script is still
# writing, which reads as "no match" and quietly inverts these assertions.
run() { DRY_RUN=1 "$SCRIPT" "$1" 2>&1; }
says() { # $1 haystack  $2 needle
    case "$1" in
        *"$2"*) echo yes ;;
        *) echo no ;;
    esac
}
check() { # $1 label  $2 expected  $3 actual
    if [ "$2" = "$3" ]; then
        echo "  ok    $1"
    else
        echo "  FAIL  $1: expected '$2', got '$3'"
        failures=$((failures + 1))
    fi
}

cd "$REPO" || exit 1
git init -q .
git config user.email t@t.t
git config user.name t
git config commit.gpgsign false

for tag in v1.0.0 v1.1.0-alpha.1 v1.1.0-alpha.2 v1.1.0-rc.1 v1.1.0; do
    git commit -q --allow-empty -m "work before ${tag}"
    git tag -a "$tag" -m "$tag"
done
git tag -a vjunk -m vjunk

CREATE="would run: gh release create"

stable=$(run v1.1.0)
alpha=$(run v1.1.0-alpha.2)
rc=$(run v1.1.0-rc.1)

check "a stable tag publishes" yes "$(says "$stable" "$CREATE")"
check "a nightly alpha tag does not" no "$(says "$alpha" "$CREATE")"
check "an rc tag does not" no "$(says "$rc" "$CREATE")"
check "a tag that merely starts with v does not publish" no "$(says "$(run vjunk)" "$CREATE")"
check "a tag absent from the checkout does not publish" no "$(says "$(run v9.9.9)" "$CREATE")"

# The reason matters: a prerelease is an expected skip, so it must not raise a CI
# warning annotation the way a malformed tag does.
check "a prerelease skip is quiet, not a warning" no "$(says "$alpha" '::warning::')"
check "a prerelease skip says why" yes "$(says "$alpha" 'by design')"
check "a malformed tag does warn" yes "$(says "$(run vjunk)" '::warning::')"

check "the newest stable claims the Latest badge" yes "$(says "$stable" ' --latest')"
check "an older stable leaves the Latest badge alone" no "$(says "$(run v1.0.0)" ' --latest')"

# Notes range comes from the previous stable, never the prereleases between them.
check "notes range starts at the previous stable" yes \
    "$(says "$stable" 'notes range: v1.0.0..v1.1.0')"

if [ "$failures" -gt 0 ]; then
    echo "publish-github-release: ${failures} failure(s)"
    exit 1
fi
echo "publish-github-release: all checks passed"
