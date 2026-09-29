#!/usr/bin/env bash
set -euo pipefail

# A placeholder: it prints a summary into the run log and sends nothing. The
# real Slack card is still ~150 inline lines inside .bitrise/bitrise.yml and
# has to be extracted into a tracked script before this job can post it.
echo "pera-ci: notify for ${CI_TAG}"
echo "  test:      ${CI_JOB_STATUS_TEST:-unknown}"
echo "  changelog: ${CI_JOB_STATUS_CHANGELOG:-unknown}"
echo "  android:   ${CI_JOB_STATUS_ANDROID_PRODUCTION:-${CI_JOB_STATUS_ANDROID_STAGING:-n/a}}"
echo "  ios:       ${CI_JOB_STATUS_IOS_PRODUCTION:-${CI_JOB_STATUS_IOS_STAGING:-n/a}}"
echo "  web:       ${CI_JOB_STATUS_WEB_PRODUCTION:-${CI_JOB_STATUS_WEB_STAGING:-n/a}}"
