#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <last_sha>" >&2
  exit 1
fi

LAST_SHA=$1

if [ -n "$LAST_SHA" ] && git cat-file -t "$LAST_SHA" >/dev/null 2>&1; then
  echo "Found last successful build at commit: $LAST_SHA" >&2
  LAST_REF="$LAST_SHA"
else
  echo "No previous successful build found, using initial commit" >&2
  LAST_REF=$(git rev-list --max-parents=0 HEAD)
fi

echo "Generating changelog from $LAST_REF to HEAD" >&2

# Generate changelog from conventional commits
CHANGELOG=""

# Helper function to format sections
format_section() {
  local title="$1"
  local content="$2"
  
  if [ -z "$content" ]; then
    return
  fi

  # Convert JIRA identifiers to Slack links (e.g. PERA-123 -> <url|PERA-123>)
  # Using # as sed delimiter to avoid escaping slashes in URL
  # Using -n and p to ensure we only print transformed lines if needed, but here simple s///g is fine
  local linked_content=$(echo "$content" | sed -E 's#(PERA-[0-9]+)#<https://algorandfoundation.atlassian.net/browse/\1|\1>#g')

  printf "%s\n" "$title"
  local count=$(echo "$content" | grep -c "^")
  if [ "$count" -gt 7 ]; then
    echo "$linked_content" | head -n 7 | while IFS= read -r line; do echo "- $line"; done
    local more=$((count - 7))
    echo "- ...and $more more"
  else
    echo "$linked_content" | while IFS= read -r line; do echo "- $line"; done
  fi
}

# Features
FEATURES=$(git log ${LAST_REF}..HEAD --pretty=format:"%s" --grep="^feat" | sed -E 's/^feat(\([^)]*\))?[:]? *//')
if [ -n "$FEATURES" ]; then
  SECTION=$(format_section "*Features:*" "$FEATURES")
  CHANGELOG="${CHANGELOG}${SECTION}"$'\n\n'
fi

# Bug fixes
FIXES=$(git log ${LAST_REF}..HEAD --pretty=format:"%s" --grep="^fix" | sed -E 's/^fix(\([^)]*\))?[:]? *//')
if [ -n "$FIXES" ]; then
  SECTION=$(format_section "*Bug Fixes:*" "$FIXES")
  CHANGELOG="${CHANGELOG}${SECTION}"$'\n\n'
fi

# Other changes (chore, refactor, perf, test, docs, build)
OTHER=$(git log ${LAST_REF}..HEAD --pretty=format:"%s" --grep="^\(chore\|refactor\|perf\|test\|docs\|build\)" | sed -E 's/^(chore|refactor|perf|test|docs|build)(\([^)]*\))?[:]? *//')
if [ -n "$OTHER" ]; then
  SECTION=$(format_section "*Other:*" "$OTHER")
  CHANGELOG="${CHANGELOG}${SECTION}"$'\n\n'
fi

# If no conventional commits found, show recent commits
if [ -z "$CHANGELOG" ]; then
  RECENT_LOG=$(git log ${LAST_REF}..HEAD --pretty=format:"%s" --no-merges | head -10)
  if [ -n "$RECENT_LOG" ]; then
    # Convert JIRA identifiers to Slack links
    RECENT_LINKED=$(echo "$RECENT_LOG" | sed -E 's#(PERA-[0-9]+)#<https://algorandfoundation.atlassian.net/browse/\1|\1>#g')
    RECENT=$(echo "$RECENT_LINKED" | while IFS= read -r line; do echo "• $line"; done)
    CHANGELOG="*Recent commits:*\n${RECENT}"
  else
    CHANGELOG="No changes since last build"
  fi
fi

echo "$CHANGELOG"

