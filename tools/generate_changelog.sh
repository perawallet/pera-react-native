#!/bin/bash

# Two consumers, one set of changelog rules: the Slack release card wants
# `<url|PERA-123>` link syntax and a short list, the changelog artifact
# uploaded alongside it wants plain text and every entry.
#   LINK_FORMAT  slack (default) renders jira refs as Slack links; plain
#                leaves the bare ticket id
#   MAX_COUNT    entries per section; 0 means uncapped. A positional $2 still
#                wins, so existing callers are unaffected.
MAX_COUNT="${MAX_COUNT:-7}"
LINK_FORMAT="${LINK_FORMAT:-slack}"

if [ -z "$1" ]; then
  # No SHA provided, try to find initial commit or just use HEAD~1
  LAST_SHA=""
else
  LAST_SHA=$1
fi

if [ -n "$LAST_SHA" ] && git cat-file -t "$LAST_SHA" >/dev/null 2>&1; then
  echo "Found last successful build at commit: $LAST_SHA" >&2
  LAST_REF="$LAST_SHA"
else
  echo "No previous successful build found (or invalid SHA), using initial commit" >&2
  # Fallback to the first commit if possible, or just log from the beginning
  LAST_REF=$(git rev-list --max-parents=0 HEAD | head -n 1)
fi

if [ ! -z "$2" ]; then
  MAX_COUNT=$2
fi

echo "Generating changelog from $LAST_REF to HEAD" >&2

# Generate changelog from conventional commits
CHANGELOG=""

# `#` as the sed delimiter so the URL's slashes need no escaping.
link_refs() {
  if [ "$LINK_FORMAT" = "plain" ]; then
    printf '%s\n' "$1"
    return
  fi
  echo "$1" | sed -E 's#(PERA-[0-9]+)#<https://algorandfoundation.atlassian.net/browse/\1|\1>#g'
}

# Helper function to format sections
format_section() {
  local title="$1"
  local content="$2"
  
  if [ -z "$content" ]; then
    return
  fi

  local linked_content
  linked_content=$(link_refs "$content")

  # `*Features:*` is Slack bold, not markdown — strip it for the plain artifact.
  if [ "$LINK_FORMAT" = "plain" ]; then
    printf "%s\n" "${title//\*/}"
  else
    printf "%s\n" "$title"
  fi
  local count=$(echo "$content" | grep -c "^")
  if [ "$MAX_COUNT" -gt 0 ] && [ "$count" -gt "$MAX_COUNT" ]; then
    echo "$linked_content" | head -n "$MAX_COUNT" | while IFS= read -r line; do echo "- $line"; done
    local more=$((count - MAX_COUNT))
    echo "- ...and $more more"
  else
    echo "$linked_content" | while IFS= read -r line; do echo "- $line"; done
  fi
}

# Features
FEATURES=$(git log ${LAST_REF}..HEAD --pretty=format:"%s" --grep="^feat" | sed -E 's/^feat\(([^)]*)\)[:]? */\1: /; s/^feat[:]? *//')
if [ -n "$FEATURES" ]; then
  SECTION=$(format_section "*Features:*" "$FEATURES")
  CHANGELOG="${CHANGELOG}${SECTION}"$'\n\n'
fi

# Bug fixes
FIXES=$(git log ${LAST_REF}..HEAD --pretty=format:"%s" --grep="^fix" | sed -E 's/^fix\(([^)]*)\)[:]? */\1: /; s/^fix[:]? *//')
if [ -n "$FIXES" ]; then
  SECTION=$(format_section "*Bug Fixes:*" "$FIXES")
  CHANGELOG="${CHANGELOG}${SECTION}"$'\n\n'
fi

# Other changes (chore, refactor, perf, test, docs, build)
OTHER=$(git log ${LAST_REF}..HEAD --pretty=format:"%s" --grep="^\(chore\|refactor\|perf\|test\|docs\|build\)" | sed -E 's/^(chore|refactor|perf|test|docs|build)\(([^)]*)\)[:]? */\2: /; s/^(chore|refactor|perf|test|docs|build)[:]? *//')
if [ -n "$OTHER" ]; then
  SECTION=$(format_section "*Other:*" "$OTHER")
  CHANGELOG="${CHANGELOG}${SECTION}"$'\n\n'
fi

# If no conventional commits found, show recent commits
if [ -z "$CHANGELOG" ]; then
  RECENT_LOG=$(git log ${LAST_REF}..HEAD --pretty=format:"%s" --no-merges | head -10)
  if [ -n "$RECENT_LOG" ]; then
    RECENT_LINKED=$(link_refs "$RECENT_LOG")
    RECENT=$(echo "$RECENT_LINKED" | while IFS= read -r line; do echo "• $line"; done)
    CHANGELOG="*Recent commits:*\n${RECENT}"
  else
    CHANGELOG="No changes since last build"
  fi
fi

echo "$CHANGELOG"

