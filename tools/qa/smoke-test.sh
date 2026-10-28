#!/usr/bin/env bash
# tools/qa/smoke-test.sh
# Release smoke gate: uploads a freshly built artifact to BrowserStack and runs
# the account-creation case of the e2e suite (e2e/) against it.
#
# The gate answers one question — does a clean install launch, create a wallet,
# and reach the home screen? Anything broader belongs in the full e2e run
# (e2e/tools/browserstack.sh).
#
# The artifact MUST have been built with DISABLE_SCREEN_CAPTURE_PREVENTION=true.
# Appium cannot drive a FLAG_SECURE surface, so a store-configured build simply
# hangs here rather than failing usefully.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

PLATFORM="${1:-}"
ARTIFACT="${2:-}"

usage() {
  cat >&2 <<EOF
Usage: tools/qa/smoke-test.sh <ios|android> <artifact>

  ios      <artifact> is an .ipa already patched by tools/qa/patch-ipa-for-browserstack.sh
  android  <artifact> is an .apk (BrowserStack cannot install an .aab)

Environment:
  BROWSERSTACK_USERNAME        required
  BROWSERSTACK_ACCESS_KEY      required
  SMOKE_TAG                    Robot tag to select (default: release-gate)
  SMOKE_SUITE                  suite file (default: e2e/tests/onboarding.robot)
  SMOKE_RESULTS_DIR            Robot output dir (default: ./smoke-results)
  UV_VERSION                   uv release used to build the e2e venv
EOF
  exit 1
}

case "$PLATFORM" in
  ios | android) ;;
  *) usage ;;
esac

[[ -f "$ARTIFACT" ]] || { echo "Error: artifact '$ARTIFACT' not found" >&2; usage; }
: "${BROWSERSTACK_USERNAME:?BROWSERSTACK_USERNAME is required}"
: "${BROWSERSTACK_ACCESS_KEY:?BROWSERSTACK_ACCESS_KEY is required}"

# The gate installs and runs third-party test tooling (the BrowserStack SDK,
# Robot and their dependencies) in this environment, where CI exposes every
# secret to every step. It needs none of the signing or store credentials, so
# drop them before it runs.
# ponytail: denylist, so a new secret leaks until listed; an `env -i` allowlist
# around the run closes that once its required vars are pinned down.
unset ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS \
  ANDROID_KEY_PASSWORD ANDROID_JSON_KEY_FILE FIREBASE_SERVICE_ACCOUNT_BASE64 \
  APP_STORE_CONNECT_API_KEY_CONTENT APP_STORE_CONNECT_API_KEY_ISSUER_ID \
  APP_STORE_CONNECT_API_KEY_KEY_ID BITRISE_CERTIFICATE_URL \
  BITRISE_CERTIFICATE_PASSPHRASE BITRISE_PROVISION_URL BITRISE_KEYCHAIN_PASSWORD \
  BITRISE_API_TOKEN SLACK_WEBHOOK_URL BACKEND_API_KEY TESTNET_BAANX_CLIENT_KEY
# The per-environment originals that tools/dev/setup-env-secrets.sh aliases from.
for var in $(compgen -v); do
  case "$var" in STAGING_* | PRODUCTION_*) unset "$var" ;; esac
done

# Its own tag rather than the suite's broader p0: a release gate should have
# exactly one reason to be red.
SMOKE_TAG="${SMOKE_TAG:-release-gate}"
SMOKE_SUITE="${SMOKE_SUITE:-$ROOT_DIR/e2e/tests/onboarding.robot}"
UV_VERSION="${UV_VERSION:-0.12.2}"

# Outside the scratch dir: the Robot report matters most when the run fails,
# and the trap below would take it with the venv.
RESULTS_DIR="${SMOKE_RESULTS_DIR:-$PWD/smoke-results}"
# The runner refuses a non-empty directory; a rerun replaces the default one's old results.
[ -n "${SMOKE_RESULTS_DIR:-}" ] || rm -rf "$RESULTS_DIR"
mkdir -p "$RESULTS_DIR"

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

# uv fetches a known interpreter rather than whatever the stack ships; pinned
# for reproducibility, --seed because the SDK expects pip.
if ! command -v uv >/dev/null 2>&1; then
  echo "--- Installing uv $UV_VERSION"
  curl -LsSf "https://astral.sh/uv/${UV_VERSION}/install.sh" \
    | env UV_INSTALL_DIR="$WORK_DIR/uv" INSTALLER_NO_MODIFY_PATH=1 sh >/dev/null
  PATH="$WORK_DIR/uv:$PATH"
fi

echo "--- Preparing the e2e venv"
uv venv --seed --quiet --python 3.11 "$WORK_DIR/venv"
uv pip install --quiet --python "$WORK_DIR/venv/bin/python" \
  -r "$ROOT_DIR/e2e/requirements-browserstack.txt"

echo "--- Running '$SMOKE_TAG' from $SMOKE_SUITE"
export BROWSERSTACK_BUILD_NAME="RN smoke ${APP_VERSION:-local} ${PLATFORM}"
RUNNER_STATUS=0
E2E_VENV="$WORK_DIR/venv" E2E_RESULTS_DIR="$RESULTS_DIR" \
  "$ROOT_DIR/e2e/tools/browserstack.sh" "$PLATFORM" "$ARTIFACT" \
  --include "$SMOKE_TAG" "$SMOKE_SUITE" || RUNNER_STATUS=$?

VERDICT=$("$ROOT_DIR/tools/qa/smoke-verdict.sh" "$RESULTS_DIR") || true
if [ "$RUNNER_STATUS" -ne 0 ]; then VERDICT=fail; fi
# Written for the Bitrise publish step, which runs in a separate shell with no
# e2e venv and so cannot re-derive this itself.
printf '%s' "$VERDICT" >"$RESULTS_DIR/verdict"
echo "--- Smoke verdict: ${VERDICT}"

if [ "$VERDICT" = "ok" ]; then
  exit 0
fi

# SMOKE_STRICT is the mute switch for triage. Flipping it keeps the verdict
# flowing to Slack; the alternative people reach for under pressure is
# trusting the SDK's exit code, which reports success for failed runs.
if [ "${SMOKE_STRICT:-true}" = "true" ]; then
  exit 1
fi
echo "--- SMOKE_STRICT is off: reporting the failure without failing the build"
exit 0
