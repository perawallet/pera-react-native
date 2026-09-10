#!/usr/bin/env bash
set -uo pipefail

# Git skips a hook whose symlink dangles without printing anything, so a link
# left pointing at a moved target silently retires the pre-push and commit-msg
# gates. Setup is the only thing that can notice, so it has to relink rather
# than report the stale link as already wired.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dev-setup.sh"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

failures=0
check() { # $1 label  $2 expected  $3 actual
    if [ "$2" = "$3" ]; then
        echo "  ok    $1"
    else
        echo "  FAIL  $1: expected '$2', got '$3'"
        failures=$((failures + 1))
    fi
}

# Hooks are written without the executable bit so the chmod setup performs is
# what makes them runnable.
fresh_clone() { # $1 name -> echoes the path
    local repo="$WORK/$1"
    mkdir -p "$repo/tools"
    git init -q "$repo"
    git -C "$repo" config user.email t@t.t
    git -C "$repo" config user.name t
    git -C "$repo" config commit.gpgsign false
    printf '#!/bin/sh\nexit 0\n' >"$repo/tools/pre-push"
    printf '#!/bin/sh\nexit 0\n' >"$repo/tools/commit-msg"
    printf '%s' "$repo"
}

run_setup() { (cd "$1" && "$SCRIPT" >/dev/null 2>&1); }
resolves() { if [ -e "$1" ]; then echo yes; else echo no; fi; }

REPO=$(fresh_clone fresh)
run_setup "$REPO"
check "wires pre-push on a fresh clone" "../../tools/pre-push" \
    "$(readlink "$REPO/.git/hooks/pre-push")"
check "wires commit-msg on a fresh clone" "../../tools/commit-msg" \
    "$(readlink "$REPO/.git/hooks/commit-msg")"
check "makes the hook executable" "yes" \
    "$([ -x "$REPO/tools/pre-push" ] && echo yes || echo no)"

run_setup "$REPO"
check "a repeat run backs nothing up" "" \
    "$(ls "$REPO"/.git/hooks/*.backup 2>/dev/null)"

# The layout change this guards against: the link still names the path the
# hook used to live at.
REPO=$(fresh_clone moved-target)
ln -s ../../tools/hooks/pre-push "$REPO/.git/hooks/pre-push"
check "the stale link starts out broken" "no" "$(resolves "$REPO/.git/hooks/pre-push")"

run_setup "$REPO"
check "relinks a hook whose target moved" "../../tools/pre-push" \
    "$(readlink "$REPO/.git/hooks/pre-push")"
check "the relinked hook resolves" "yes" "$(resolves "$REPO/.git/hooks/pre-push")"
check "relinking backs nothing up" "" \
    "$(ls "$REPO"/.git/hooks/*.backup 2>/dev/null)"

REPO=$(fresh_clone hand-written)
printf '#!/bin/sh\nexit 0\n' >"$REPO/.git/hooks/pre-push"
run_setup "$REPO"
check "keeps a hand-written hook as a backup" "yes" \
    "$([ -f "$REPO/.git/hooks/pre-push.backup" ] && echo yes || echo no)"
check "and replaces it with the symlink" "../../tools/pre-push" \
    "$(readlink "$REPO/.git/hooks/pre-push")"

# The consequence the whole fix exists for: a relinked hook actually runs.
REPO=$(fresh_clone honoured)
ln -s ../../tools/hooks/commit-msg "$REPO/.git/hooks/commit-msg"
printf '#!/bin/sh\nexit 1\n' >"$REPO/tools/commit-msg"
run_setup "$REPO"
echo change >"$REPO/file"
git -C "$REPO" add file
check "git honours the relinked hook" "1" \
    "$(git -C "$REPO" commit -q -m "chore: rejected by the hook" >/dev/null 2>&1; echo $?)"

# ln -s links to a missing path without complaint, so an incomplete checkout
# could otherwise install the very dangling hook this script guards against —
# and die before reaching the second one.
REPO=$(fresh_clone missing-target)
rm "$REPO/tools/pre-push"
run_setup "$REPO"
status=$?
check "fails when a hook is missing from tools/" "1" "$status"
check "leaves no link behind for it" "" \
    "$(readlink "$REPO/.git/hooks/pre-push" 2>/dev/null)"
check "still wires the hook that is present" "../../tools/commit-msg" \
    "$(readlink "$REPO/.git/hooks/commit-msg")"

# A worktree's .git is a file, not a directory, and its hooks belong to the main
# checkout — so there is nothing to create locally and nothing to assume.
REPO=$(fresh_clone worktree-parent)
WT="$WORK/worktree-child"
printf '#!/bin/sh\nexit 1\n' >"$REPO/tools/commit-msg"
(
    cd "$REPO" || exit 1
    git add -A
    git commit -q -m "chore: seed"
    git worktree add -q "$WT"
)
run_setup "$WT"
status=$?
check "succeeds inside a worktree" "0" "$status"
check "wires the main checkout's hooks dir" "../../tools/commit-msg" \
    "$(readlink "$REPO/.git/hooks/commit-msg")"
echo change >"$WT/file"
git -C "$WT" add file
check "and Git in the worktree runs the hook it linked" "1" \
    "$(git -C "$WT" commit -q -m "chore: rejected by the hook" >/dev/null 2>&1; echo $?)"

if [ "$failures" -gt 0 ]; then
    echo "dev-setup: ${failures} failure(s)"
    exit 1
fi
echo "dev-setup: all checks passed"
