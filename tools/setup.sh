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

# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

# Create symlink for pre-commit hook
if [ -L .git/hooks/pre-commit ]; then
  echo "  • Pre-commit hook symlink already exists"
elif [ -f .git/hooks/pre-commit ]; then
  echo "  • Backing up existing pre-commit hook to pre-commit.backup"
  mv .git/hooks/pre-commit .git/hooks/pre-commit.backup
  ln -s ../../tools/pre-commit .git/hooks/pre-commit
  echo "  • Pre-commit hook symlink created"
else
  ln -s ../../tools/pre-commit .git/hooks/pre-commit
  echo "  • Pre-commit hook symlink created"
fi

# Make sure the pre-commit script is executable
chmod +x tools/pre-commit

# Create symlink for pre-push hook
if [ -L .git/hooks/pre-push ]; then
  echo "  • Pre-push hook symlink already exists"
elif [ -f .git/hooks/pre-push ]; then
  echo "  • Backing up existing pre-push hook to pre-push.backup"
  mv .git/hooks/pre-push .git/hooks/pre-push.backup
  ln -s ../../tools/pre-push .git/hooks/pre-push
  echo "  • Pre-push hook symlink created"
else
  ln -s ../../tools/pre-push .git/hooks/pre-push
  echo "  • Pre-push hook symlink created"
fi

# Make sure the pre-push script is executable
chmod +x tools/pre-push

echo -e "${GREEN}✓ Git hooks configured${NC}"

# Add any additional setup steps here in the future
# Example:
# echo -e "${YELLOW}Installing dependencies...${NC}"
# pnpm install

echo -e "\n${GREEN}✅ Project setup complete!${NC}"
echo -e "Git hooks are now active and will run on every commit and push."