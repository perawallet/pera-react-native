#!/bin/bash
# Project setup script
# Run this after cloning the repository or when updating hooks

set -e

echo "🚀 Setting up Pera Wallet project..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Set up Git hooks
echo -e "${YELLOW}Setting up Git hooks...${NC}"

# A worktree's .git is a file rather than a directory, and its hooks are the
# main checkout's. Asking git for the common dir handles that, and resolves from
# a subdirectory too, so nothing here depends on the working directory.
HOOKS_DIR="$(git rev-parse --git-common-dir)/hooks"
mkdir -p "$HOOKS_DIR"

missing=0

# A symlink whose target has moved is still a symlink, so testing -L alone
# reports the hook as wired while Git silently skips it — the push or commit
# then goes through unchecked, with no warning. Require the target to resolve.
link_hook() {
  local hook="$1"
  local link="${HOOKS_DIR}/${hook}"
  local target="../../tools/${hook}"

  # ln -s links happily to a missing path, which would leave behind exactly the
  # silently-skipped hook this is here to prevent. Check before linking, and
  # keep going so one missing file cannot cost us the other hook.
  if [ ! -e "${HOOKS_DIR}/${target}" ]; then
    echo "  • ${hook}: tools/${hook} is missing — not linked" >&2
    missing=1
    return 0
  fi

  if [ -L "$link" ] && [ -e "$link" ]; then
    echo "  • ${hook} hook symlink already exists"
  else
    if [ -L "$link" ]; then
      echo "  • Relinking broken ${hook} hook symlink"
      rm "$link"
    elif [ -e "$link" ]; then
      echo "  • Backing up existing ${hook} hook to ${hook}.backup"
      mv "$link" "${link}.backup"
    fi

    ln -s "$target" "$link"
    echo "  • ${hook} hook symlink created"
  fi

  # Follows the symlink, so this is the tools/ copy Git will execute.
  chmod +x "$link"
}

link_hook pre-push
link_hook commit-msg

if [ "$missing" = 1 ]; then
  echo -e "${YELLOW}Some hooks were not installed — check your checkout.${NC}" >&2
  exit 1
fi

echo -e "${GREEN}✓ Git hooks configured${NC}"

# Add any additional setup steps here in the future
# Example:
# echo -e "${YELLOW}Installing dependencies...${NC}"
# pnpm install

echo -e "\n${GREEN}✅ Project setup complete!${NC}"
echo -e "Git hooks are now active:"
echo -e "  • Commit-msg: conventional commit validation"
echo -e "  • Pre-push: linting, formatting, copyright checks, and tests"