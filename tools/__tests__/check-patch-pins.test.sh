#!/usr/bin/env bash
set -uo pipefail

# Pins check-patch-pins.mjs, the gate standing between a moved catalog version
# and a stale `patchedDependencies` key (which pnpm only catches at install
# time, as UNUSED_PATCH). The failure it exists to catch is a FALSE PASS on a
# drifted or malformed workspace file, so every case here drives it against a
# synthetic workspace, not the repo's own (currently healthy) one.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/check-patch-pins.mjs"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

failures=0

# $1 label  $2 expected exit (0 pass / 1 fail)  $3 workspace file content
run_case() {
    local label="$1" want="$2" content="$3"
    # $(...) strips trailing newlines, and the section-body regex requires one
    # after every line (including the last) — restore it so heredoc-sourced
    # fixtures behave the same as inline ones.
    printf '%s\n' "$content" > "$WORK/pnpm-workspace.yaml"

    local output status
    output=$(node "$SCRIPT" "$WORK/pnpm-workspace.yaml" 2>&1)
    status=$?
    if [ "$status" -eq "$want" ]; then
        echo "  ok    ${label}"
    else
        echo "  FAIL  ${label}: expected exit ${want}, got ${status}"
        echo "        ${output}"
        failures=$((failures + 1))
    fi
}

echo "── baseline"
run_case "matching patch and catalog versions pass" 0 "$(cat <<'EOF'
catalog:
  "@algorandfoundation/react-native-passkey-autofill": 1.0.0-canary.26
patchedDependencies:
  "@algorandfoundation/react-native-passkey-autofill@1.0.0-canary.26": patches/x.patch
EOF
)"
run_case "drifted patch version fails" 1 "$(cat <<'EOF'
catalog:
  "@algorandfoundation/react-native-passkey-autofill": 1.0.0-canary.26
patchedDependencies:
  "@algorandfoundation/react-native-passkey-autofill@1.0.0-canary.24": patches/x.patch
EOF
)"

echo "── finding 1: unquoted patchedDependencies key"
# YAML doesn't require quoting a plain-scalar key; a patch key without quotes
# must still be read, not silently skipped as unparseable.
run_case "an unquoted patch key with a drifted version is still caught" 1 "$(cat <<'EOF'
catalog:
  "pkg": 1.0.0
patchedDependencies:
  pkg@0.9.0: patches/x.patch
EOF
)"

echo "── finding 2: trailing comment on a catalog line"
# pnpm-workspace.yaml is dense with inline comments; one on a catalog line
# must not make that entry vanish from the map (which would make any patch
# key for it fall through the "not catalog-pinned" skip and pass vacuously).
run_case "a trailing comment on the catalog line doesn't hide the entry" 1 "$(cat <<'EOF'
catalog:
  "pkg": 1.0.0 # keep in sync
patchedDependencies:
  "pkg@0.9.0": patches/x.patch
EOF
)"

echo "── finding 3: quoted catalog value"
# A quoted value ('>=8.20.1' style, used elsewhere in the real file) must
# compare equal to the same unquoted version in a patch key — the quotes are
# YAML syntax, not part of the version string.
run_case "a quoted catalog value matching an unquoted patch version passes" 0 "$(cat <<'EOF'
catalog:
  "pkg": "1.0.0"
patchedDependencies:
  "pkg@1.0.0": patches/x.patch
EOF
)"
run_case "a quoted catalog value that actually drifted still fails" 1 "$(cat <<'EOF'
catalog:
  "pkg": "1.0.0"
patchedDependencies:
  "pkg@0.9.0": patches/x.patch
EOF
)"

echo "── finding 9: a gate must not fail green"
run_case "an empty file fails loudly rather than passing vacuously" 1 ""
# CRLF is a real checkout state (core.autocrlf, Windows clones); the
# line-oriented section regexes are anchored on \n and must not go blind.
run_case "a CRLF file with a real drift is still caught" 1 \
    "$(printf 'catalog:\r\n  "pkg": 1.0.0\r\npatchedDependencies:\r\n  "pkg@0.9.0": patches/x.patch\r\n')"
run_case "a CRLF file with no drift still passes" 0 \
    "$(printf 'catalog:\r\n  "pkg": 1.0.0\r\npatchedDependencies:\r\n  "pkg@1.0.0": patches/x.patch\r\n')"
run_case "a renamed patchedDependencies section fails rather than passing vacuously" 1 "$(cat <<'EOF'
catalog:
  "pkg": 1.0.0
patchedDeps:
  "pkg@0.9.0": patches/x.patch
EOF
)"

echo "── finding 6: transitive-only patch entries"
# expo-modules-jsi-style entries (patched but not catalog-pinned) are a
# legitimate skip, not a bug — but the skip must be visible, not silent, so a
# typo'd package name isn't indistinguishable from an intentional one.
run_case "a patch key with no catalog entry passes, and names itself as skipped" 0 "$(cat <<'EOF'
catalog:
  "pkg": 1.0.0
patchedDependencies:
  "transitive-only@1.2.3": patches/y.patch
EOF
)"
output=$(node "$SCRIPT" "$WORK/pnpm-workspace.yaml" 2>&1)
if echo "$output" | grep -q "skipped, not catalog-pinned: transitive-only"; then
    echo "  ok    the skip names the package"
else
    echo "  FAIL  the skip does not name the package"
    echo "        ${output}"
    failures=$((failures + 1))
fi

if [ "$failures" -gt 0 ]; then
    echo "check-patch-pins: ${failures} failure(s)"
    exit 1
fi
echo "check-patch-pins: all checks passed"
