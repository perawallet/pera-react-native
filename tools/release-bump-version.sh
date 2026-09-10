#!/bin/bash

# Check if bump type is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <major|minor|patch>"
  exit 1
fi

BUMP_TYPE=$1

if [[ "$BUMP_TYPE" != "major" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "patch" ]]; then
  echo "Error: Invalid bump type '$BUMP_TYPE'. Must be one of: major, minor, patch"
  exit 1
fi

PROJECT_ROOT=$(pwd)

# Go to mobile app directory to bump package.json
cd apps/mobile || exit
echo "Bumping apps/mobile/package.json version..."
pnpm version $BUMP_TYPE --no-git-tag-version
cd ../..

# Update Android
echo "Bumping Android version name..."
bundle exec fastlane android bump_version_name bump_type:$BUMP_TYPE

# Update iOS
echo "Bumping iOS version number..."
bundle exec fastlane ios bump_version bump_type:$BUMP_TYPE

echo "✅ Version bumped ($BUMP_TYPE) across package.json, Android, and iOS."
