#!/usr/bin/env bash
# Runs the suite on BrowserStack App Automate.
#
#   tools/browserstack.sh <android|ios> <bs://app-id | .apk | .ipa> [robot args...] [suite.robot ...]
#
# With no suite file among the arguments every suite in tests/ is selected. The planner splits
# independent large suites and optionally packs compatible small suites into bounded jobs.
# Each job has its own SDK process:
# the SDK runs Robot under pabot and re-applies a one-hour process timeout over --processtimeout,
# so a single process for the whole suite is killed partway and every case after that reports an
# error. The verdict comes from the result files (tools/qa/smoke-verdict.sh), never the SDK's exit
# code, which has reported success for a failed run.
#
# Needs BROWSERSTACK_USERNAME, BROWSERSTACK_ACCESS_KEY and a venv with requirements-browserstack.txt
# (E2E_VENV, default e2e/.venv). Results go to E2E_RESULTS_DIR. An .ipa must already be patched by
# tools/qa/patch-ipa-for-browserstack.sh. Cases tagged device-shell need adb or simctl on the
# machine that runs Robot, which BrowserStack's devices are not attached to, so they are left out.
set -euo pipefail
USAGE="usage: tools/browserstack.sh <android|ios> <bs://app-id | artifact> [robot args...]"
PLATFORM="${1:?$USAGE}"
APP="${2:?$USAGE}"
shift 2
E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$E2E_DIR/.." && pwd)"
VENV="${E2E_VENV:-$E2E_DIR/.venv}"
# The SDK runs Robot under pabot, which starts `browserstack-sdk` again by name.
export PATH="$VENV/bin:$PATH"
case "$PLATFORM" in
  android | ios) ;;
  *) echo "unknown platform: $PLATFORM" >&2; exit 2 ;;
esac
: "${BROWSERSTACK_USERNAME:?BROWSERSTACK_USERNAME is required}"
: "${BROWSERSTACK_ACCESS_KEY:?BROWSERSTACK_ACCESS_KEY is required}"

mkdir -p "$E2E_DIR/results"
OUT="${E2E_RESULTS_DIR:-$(mktemp -d "$E2E_DIR/results/browserstack-$PLATFORM-$(date +%Y%m%d-%H%M%S)-XXXXXX")}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
if [ -n "$(ls -A "$OUT")" ]; then
  touch "$OUT/.incomplete"
  echo "Results directory must be empty: $OUT" >&2
  exit 2
fi
# The smoke gate also reads results independently of this script's exit code.
# Leave this marker behind on any early exit, crash, or missing suite output.
touch "$OUT/.incomplete"

if [[ "$APP" != bs://* ]]; then
  [[ -f "$APP" ]] || { echo "neither a bs:// app id nor a file: $APP" >&2; exit 2; }
  # Keyed by content, so a build already uploaded (BrowserStack keeps uploads 30 days) is reused
  # rather than sent again; a staging APK is hundreds of MB.
  HASH=$({ sha256sum "$APP" 2>/dev/null || shasum -a 256 "$APP"; } | cut -c1-16)
  CUSTOM_ID="pera-rn-e2e-$PLATFORM-$HASH"
  REUSED=$(curl --silent -u "$BROWSERSTACK_USERNAME:$BROWSERSTACK_ACCESS_KEY" \
    "https://api-cloud.browserstack.com/app-automate/recent_apps/$CUSTOM_ID" |
    jq -r 'if type == "array" then .[0].app_url // empty else empty end' 2>/dev/null || true)
fi
if [[ -n "${REUSED:-}" ]]; then
  echo "--- $(basename "$APP") is already on BrowserStack as $REUSED"
  APP="$REUSED"
elif [[ "$APP" != bs://* ]]; then
  echo "--- Uploading $(basename "$APP") to BrowserStack"
  # Inside `if !`: under set -e a bare assignment exits on the HTTP error and drops the body,
  # the only text that says why (bad key, app quota, oversized artifact).
  if ! RESPONSE=$(curl --silent --show-error --fail-with-body \
    -u "$BROWSERSTACK_USERNAME:$BROWSERSTACK_ACCESS_KEY" \
    -X POST https://api-cloud.browserstack.com/app-automate/upload \
    -F "file=@$APP" -F "custom_id=$CUSTOM_ID"); then
    echo "BrowserStack upload failed: $RESPONSE" >&2
    exit 1
  fi
  APP=$(printf '%s' "$RESPONSE" | jq -r '.app_url // empty' 2>/dev/null || true)
  [[ -n "$APP" ]] || { echo "the upload returned no app_url: $RESPONSE" >&2; exit 1; }
fi
[[ "$APP" =~ ^bs://[A-Za-z0-9]+$ ]] || { echo "not a BrowserStack app id: $APP" >&2; exit 2; }
echo "--- Running $PLATFORM against $APP"

# The SDK writes its own logs, which can hold the access key and every session capability, into its
# working directory. Results get uploaded as CI artifacts, so it runs from here and only Robot's
# outputs reach $OUT.
WORK_DIR=$(mktemp -d)
cleanup() {
  local pid
  for pid in $(jobs -pr); do kill "$pid" 2>/dev/null || true; done
  wait || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
export BROWSERSTACK_CONFIG_FILE="$WORK_DIR/browserstack.yml"
SED=(-e "s|^app:.*|app: $APP|")
# E2E_DEVICE="<deviceName>@<platformVersion>", spelled as BrowserStack's device list spells them,
# runs on that device instead of the one in the config.
if [ -n "${E2E_DEVICE:-}" ]; then
  [[ "$E2E_DEVICE" =~ ^[A-Za-z0-9\ ._()-]+@[0-9.]+$ ]] ||
    { echo "E2E_DEVICE must be <device name>@<os version>: $E2E_DEVICE" >&2; exit 2; }
  SED+=(-e "s|deviceName:.*|deviceName: ${E2E_DEVICE%@*}|"
    -e "s|platformVersion:.*|platformVersion: \"${E2E_DEVICE##*@}\"|")
fi
sed "${SED[@]}" "$E2E_DIR/browserstack-$PLATFORM.yml" >"$BROWSERSTACK_CONFIG_FILE"

SNAPSHOT="$OUT/suite-snapshot"
mkdir -p "$SNAPSHOT"
cp -R "$E2E_DIR/tests" "$E2E_DIR/resources" "$SNAPSHOT/"
find "$SNAPSHOT" -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true

ARGS=()
SUITES=()
for arg in "$@"; do
  if [[ "$arg" == *.robot ]]; then
    suite="$(cd "$(dirname "$arg")" && pwd)/$(basename "$arg")"
    if [[ "$suite" == "$E2E_DIR/tests/"* ]]; then suite="$SNAPSHOT/tests/${suite#"$E2E_DIR/tests/"}"; fi
    SUITES+=("$suite")
  else
    ARGS+=("$arg")
  fi
done
[ "${#SUITES[@]}" -gt 0 ] || SUITES=("$SNAPSHOT"/tests/*.robot)

# Excluded suites legitimately produce no XML. Filter them before starting sessions so a missing
# output from a selected suite is always an error, never hidden by another suite's passing XML.
"$VENV/bin/python" "$E2E_DIR/tools/selected_suites.py" --manifest "$OUT/selection.json" \
  --exclude slow --exclude needs-funded --exclude excludefromci --exclude device-shell \
  ${ARGS[@]+"${ARGS[@]}"} "${SUITES[@]}" >"$WORK_DIR/suites.txt"
SUITES=()
while IFS= read -r suite; do
  [ -n "$suite" ] && SUITES+=("$suite")
done <"$WORK_DIR/suites.txt"
[ "${#SUITES[@]}" -gt 0 ] || { echo "No tests selected" >&2; exit 1; }

PARALLEL="${E2E_PARALLEL:-1}"
[[ "$PARALLEL" =~ ^[1-9][0-9]*$ ]] || { echo "E2E_PARALLEL must be a positive number: $PARALLEL" >&2; exit 2; }
HISTORY="${E2E_TIMINGS_FILE:-$E2E_DIR/.cache/timings-$PLATFORM.json}"
CONTEXT="$PLATFORM|${E2E_DEVICE:-default}"
PLAN_ARGS=()
case "${E2E_SESSION_REUSE:-0}" in
  1) PLAN_ARGS+=(--reuse) ;;
  0) ;;
  *) echo "E2E_SESSION_REUSE must be 0 or 1" >&2; exit 2 ;;
esac
"$VENV/bin/python" "$E2E_DIR/tools/schedule.py" plan "$OUT/selection.json" \
  --history "$HISTORY" --context "$CONTEXT" --budget "${E2E_JOB_SECONDS:-900}" \
  --workers "$PARALLEL" --output "$OUT/plan.json" --jobs-dir "$WORK_DIR/jobs" \
  ${PLAN_ARGS[@]+"${PLAN_ARGS[@]}"} >"$WORK_DIR/jobs.txt"
JOBS=()
while IFS= read -r job; do JOBS+=("$job"); done <"$WORK_DIR/jobs.txt"
echo "--- Planned ${#JOBS[@]} jobs from ${#SUITES[@]} suites; longest estimated jobs start first"

run_job() {
  local name="$1" sdk_pid started=$SECONDS suite job_suites=()
  while IFS= read -r suite; do [ -n "$suite" ] && job_suites+=("$suite"); done <"$WORK_DIR/jobs/$name.suites"
  # One executor per SDK process; this harness uses no PabotLib locks or resource pool.
  local sdk_options=(--no-pabotlib)
  # SDK 1.51.2 delegates Robot to Pabot. Without --chunk, Pabot starts a separate
  # interpreter for each suite and a shared GLOBAL AppiumLibrary is never shared.
  if [ "$(cat "$WORK_DIR/jobs/$name.reuse")" = 1 ]; then sdk_options+=(--chunk); fi
  mkdir -p "$OUT/$name" "$WORK_DIR/$name"
  (cd "$WORK_DIR/$name" && "$VENV/bin/browserstack-sdk" robot \
    ${sdk_options[@]+"${sdk_options[@]}"} \
    --variable "PLATFORM:$PLATFORM" \
    --exclude slow --exclude needs-funded --exclude excludefromci --exclude device-shell \
    --variable "E2E_TEST_TIMEOUT:${E2E_TEST_TIMEOUT:-5 minutes}" \
    ${ARGS[@]+"${ARGS[@]}"} --outputdir "$OUT/$name" --argumentfile "$WORK_DIR/jobs/$name.args" "${job_suites[@]}") &
  sdk_pid=$!
  trap 'kill "$sdk_pid" 2>/dev/null || true; exit 143' TERM INT
  wait "$sdk_pid" || true
  printf '%s\n' "$((SECONDS - started))" >"$OUT/$name/wall-seconds"
}

# Up to E2E_PARALLEL jobs at once, each its own BrowserStack session. The plan's parallel limit
# is shared by everything on the account; past it sessions queue, and past the queue they fail.
RUN_STARTED=$SECONDS
for job in "${JOBS[@]}"; do
  # Polls rather than `wait -n`, which the macOS bash 3.2 lacks.
  while [ "$(jobs -rp | wc -l)" -ge "$PARALLEL" ]; do sleep 0.2; done
  run_job "$job" &
done
wait
"$VENV/bin/python" "$E2E_DIR/tools/schedule.py" report "$OUT/plan.json" "$OUT" \
  --elapsed "$((SECONDS - RUN_STARTED))" || echo "Warning: scheduling metrics were not written" >&2

OUTPUTS=()
MISSING=0
for name in "${JOBS[@]}"; do
  before=${#OUTPUTS[@]}
  # pabot's merge can crash after the cases ran, leaving only its per-process outputs.
  if [ -f "$OUT/$name/output.xml" ]; then
    OUTPUTS+=("$OUT/$name/output.xml")
  else
    while IFS= read -r f; do
      [ -n "$f" ] && OUTPUTS+=("$f")
    done < <(find "$OUT/$name/pabot_results" -name output.xml 2>/dev/null | sort)
  fi
  if [ "${#OUTPUTS[@]}" -eq "$before" ]; then
    echo "No results for selected job: $name" >&2
    MISSING=1
  fi
done

if [ "${#OUTPUTS[@]}" -gt 0 ]; then
  "$VENV/bin/python" "$E2E_DIR/tools/verify_results.py" "$OUT/selection.json" \
    "${OUTPUTS[@]}" || MISSING=1
  if [ "$MISSING" -eq 0 ]; then
    "$VENV/bin/python" "$E2E_DIR/tools/schedule.py" record --history "$HISTORY" \
      --context "$CONTEXT" "${OUTPUTS[@]}" || echo "Warning: duration history was not updated" >&2
  fi
  "$VENV/bin/rebot" --nostatusrc --name "Pera e2e $PLATFORM" --outputdir "$OUT" --output output.xml --xunit xunit.xml \
    "${OUTPUTS[@]}" >/dev/null || MISSING=1
fi
if [ "$MISSING" -eq 0 ] && [ -f "$OUT/output.xml" ]; then
  rm "$OUT/.incomplete"
fi
VERDICT=$("$REPO_DIR/tools/qa/smoke-verdict.sh" "$OUT") || true
echo "--- $PLATFORM verdict: $VERDICT; results in $OUT"
[ "$VERDICT" = ok ] && [ "$MISSING" -eq 0 ]
