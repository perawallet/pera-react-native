#!/usr/bin/env bash
# tools/smoke-test.sh
# Release smoke gate: uploads a freshly built artifact to BrowserStack and runs
# the account-creation suite from the platform's E2E harness against it.
#
# The gate answers one question — does a clean install launch, create a wallet,
# and reach the home screen? Anything broader belongs in the harness repos'
# own scheduled regression runs.
#
# The artifact MUST have been built with DISABLE_SCREEN_CAPTURE_PREVENTION=true.
# Appium cannot drive a FLAG_SECURE surface, so a store-configured build simply
# hangs here rather than failing usefully.
set -euo pipefail

PLATFORM="${1:-}"
ARTIFACT="${2:-}"

usage() {
  cat >&2 <<EOF
Usage: tools/smoke-test.sh <ios|android> <artifact>

  ios      <artifact> is an .ipa already patched by tools/patch-ipa-for-browserstack.sh
  android  <artifact> is an .apk (BrowserStack cannot install an .aab)

Environment:
  BROWSERSTACK_USERNAME        required
  BROWSERSTACK_ACCESS_KEY      required
  SMOKE_HARNESS_GITHUB_TOKEN   required — read access to the harness repo
  SMOKE_HARNESS_REF            harness git ref (default: main)
  SMOKE_TAG                    Robot tag to select (default: release-gate)
  SMOKE_SUITE                  suite file (default: Tests/OnboardingTest.robot)
  SMOKE_RESULTS_DIR            Robot output dir (default: ./smoke-results)
  UV_VERSION                   uv release used to build the harness venv
EOF
  exit 1
}

# Each harness pins its requirements against the interpreter its own CI
# validates; resolving them on a newer python breaks pinned sdists.
case "$PLATFORM" in
  ios) HARNESS_REPO="perawallet/pera-ios-tests"; HARNESS_PYTHON="3.9" ;;
  android) HARNESS_REPO="perawallet/pera-android-tests"; HARNESS_PYTHON="3.11" ;;
  *) usage ;;
esac

[[ -f "$ARTIFACT" ]] || { echo "Error: artifact '$ARTIFACT' not found" >&2; usage; }
: "${BROWSERSTACK_USERNAME:?BROWSERSTACK_USERNAME is required}"
: "${BROWSERSTACK_ACCESS_KEY:?BROWSERSTACK_ACCESS_KEY is required}"
: "${SMOKE_HARNESS_GITHUB_TOKEN:?SMOKE_HARNESS_GITHUB_TOKEN is required}"

HARNESS_REF="${SMOKE_HARNESS_REF:-main}"
# Its own tag rather than the harness's broader `smoke`: a release gate should
# have exactly one reason to be red, and `smoke` also covers UI-inventory cases
# that say nothing about whether the app launches.
SMOKE_TAG="${SMOKE_TAG:-release-gate}"
SMOKE_SUITE="${SMOKE_SUITE:-Tests/OnboardingTest.robot}"
UV_VERSION="${UV_VERSION:-0.12.2}"

# Outside the scratch dir: the Robot report matters most when the run fails,
# and the trap below would take it with the harness checkout.
RESULTS_DIR="${SMOKE_RESULTS_DIR:-$PWD/smoke-results}"
mkdir -p "$RESULTS_DIR"

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

echo "--- Uploading $(basename "$ARTIFACT") to BrowserStack"
# `|| ...` rather than a bare assignment: --fail-with-body makes curl exit
# non-zero on 4xx/5xx *and* still emit the body, but under `set -e` a bare
# assignment aborts the script on that exit code and throws the body away —
# losing the only text that says why (bad key, app quota, oversized artifact).
if ! UPLOAD_RESPONSE=$(curl --silent --show-error --fail-with-body \
  -u "${BROWSERSTACK_USERNAME}:${BROWSERSTACK_ACCESS_KEY}" \
  -X POST "https://api-cloud.browserstack.com/app-automate/upload" \
  -F "file=@${ARTIFACT}" \
  -F "custom_id=pera-rn-smoke-${PLATFORM}"); then
  echo "Error: BrowserStack upload failed: ${UPLOAD_RESPONSE}" >&2
  exit 1
fi

# `|| true` guards against a non-JSON 2xx (a proxy or WAF interstitial), which
# would otherwise abort here on jq's parse error instead of the report below.
APP_URL=$(printf '%s' "$UPLOAD_RESPONSE" | jq -r '.app_url // empty' 2>/dev/null || true)
if [[ -z "$APP_URL" ]]; then
  echo "Error: upload returned no app_url: ${UPLOAD_RESPONSE}" >&2
  exit 1
fi
echo "--- Uploaded as $APP_URL"

echo "--- Cloning $HARNESS_REPO@$HARNESS_REF"
git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $(printf 'x-access-token:%s' "$SMOKE_HARNESS_GITHUB_TOKEN" | base64 | tr -d '\n')" \
  clone --depth 1 --branch "$HARNESS_REF" \
  "https://github.com/${HARNESS_REPO}.git" "$WORK_DIR/harness" --quiet

cd "$WORK_DIR/harness"

# uv fetches the interpreter the harness expects rather than whatever the
# stack ships; pinned for reproducibility, --seed because the SDK expects pip.
if ! command -v uv >/dev/null 2>&1; then
  echo "--- Installing uv $UV_VERSION"
  curl -LsSf "https://astral.sh/uv/${UV_VERSION}/install.sh" \
    | env UV_INSTALL_DIR="$WORK_DIR/uv" INSTALLER_NO_MODIFY_PATH=1 sh >/dev/null
  PATH="$WORK_DIR/uv:$PATH"
fi

echo "--- Preparing harness venv on Python $HARNESS_PYTHON"
uv venv --seed --quiet --python "$HARNESS_PYTHON" .venv
# shellcheck disable=SC1091
source .venv/bin/activate
uv pip install --quiet -r requirements.txt

# The harness pins a manually-uploaded build in browserstack.yml; point it at
# the artifact this pipeline just produced instead.
export BROWSERSTACK_APP="$APP_URL"
export BROWSERSTACK_BUILD_NAME="RN smoke ${APP_VERSION:-local} ${PLATFORM}"
./scripts/apply-browserstack-app.sh

echo "--- Running '$SMOKE_TAG' from $SMOKE_SUITE"
browserstack-sdk robot --outputdir "$RESULTS_DIR" --include "$SMOKE_TAG" "$SMOKE_SUITE"
