#!/usr/bin/env bash
# set -e without -x: keep the Slack webhook URL out of the run log.
set -euo pipefail

# The release card from bitrise.yml's _notify-card, one row per build. A row is
# ✅ only for an explicit success: a skipped build was skipped because
# something upstream failed, so it reads as a failed release, as on Bitrise.
case "$CI_TAG" in
  *-alpha.*) CHANNEL="Nightly" OVERALL="🌙" ;;
  *-rc.*) CHANNEL="RC" OVERALL="⭐" ;;
  *) CHANNEL="Release" OVERALL="🚀" ;;
esac
COLOR="#36a64f"

ROWS=""
row() { # $1 status  $2 label  $3 destination
  local emoji="✅" dest="$3"
  if [ "$1" != "success" ]; then
    emoji="❌" OVERALL="❌" COLOR="#ec0000"
  fi
  if [ "${CI_UPLOADS_ENABLED:-false}" != "true" ] && [ "$dest" != "BrowserStack" ]; then
    dest="not uploaded"
  fi
  ROWS="${ROWS:+$ROWS$'\n'}${emoji}  *$2*  →  ${dest}"
}

# Tests get no row but still turn the card red: their failure is why the
# builds below were skipped.
if [ "${CI_JOB_STATUS_TEST:-}" != "success" ]; then
  OVERALL="❌" COLOR="#ec0000"
fi

# The two pipelines build different things; a row for a job the pipeline never
# has would read as a failed build.
if [ "${CARD_ROWS:-production}" = "staging" ]; then
  row "${CI_JOB_STATUS_ANDROID_STAGING:-}" "Android staging" "Firebase"
  row "${CI_JOB_STATUS_IOS_STAGING:-}" "iOS staging" "TestFlight"
  row "${CI_JOB_STATUS_WEB_STAGING:-}" "Web staging" "Artifact"
  row "${CI_JOB_STATUS_SMOKE_IOS:-}" "iOS smoke gate" "BrowserStack"
  row "${CI_JOB_STATUS_SMOKE_ANDROID:-}" "Android smoke gate" "BrowserStack"
else
  row "${CI_JOB_STATUS_ANDROID_PRODUCTION:-}" "Android production" "Play internal"
  row "${CI_JOB_STATUS_IOS_PRODUCTION:-}" "iOS production" "TestFlight"
  row "${CI_JOB_STATUS_WEB_PRODUCTION:-}" "Web production" "Artifact"
fi

# Capped before it goes into the JSON: Slack drops the whole payload once a
# section passes 3000 characters. See tools/cap-changelog.sh.
CHANGELOG="${CI_OUT_CHANGELOG_TEXT:-Release build - see git history for changes}"
CHANGELOG=$(printf '%s' "$CHANGELOG" | ./tools/cap-changelog.sh 2500)

PAYLOAD=$(jq -n \
  --arg header "${OVERALL} RN ${CHANNEL} ${CI_TAG}" \
  --arg color "$COLOR" \
  --arg rows "$ROWS" \
  --arg notes "*Changes since last build:*"$'\n'"$CHANGELOG" \
  '{
    username: "Pera CI",
    blocks: [{ type: "header", text: { type: "plain_text", text: $header, emoji: true } }],
    attachments: [{
      color: $color,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: $rows } },
        { type: "divider" },
        { type: "section", text: { type: "mrkdwn", text: $notes } }
      ]
    }]
  }')

printf '%s\n' "$PAYLOAD"

# While uploads are off Bitrise still posts the real card for the same tag, so
# a second one would only be noise in the channel.
if [ "${CI_UPLOADS_ENABLED:-false}" != "true" ]; then
  echo "pera-ci: uploads disabled; not posting the card"
  exit 0
fi

# --fail-with-body: without it curl exits 0 on a 4xx/5xx and the card silently
# never arrives.
printf '%s' "$PAYLOAD" | curl -sS --fail-with-body --retry 2 --max-time 30 -X POST "$SLACK_WEBHOOK_URL" \
  -H "Content-Type: application/json" -d @-
