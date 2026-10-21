#!/usr/bin/env bash
set -uo pipefail

# Drives upload-chrome-web-store.mjs against a local stand-in for Google's token
# endpoint and the Chrome Web Store API. The stand-in verifies the JWT against a
# throwaway key, so a signing regression fails here rather than on a release tag.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/release/upload-chrome-web-store.mjs"
WORK=$(mktemp -d)
STUB_PID=""
trap '[ -n "$STUB_PID" ] && { kill "$STUB_PID"; wait "$STUB_PID"; } 2>/dev/null; rm -rf "$WORK"' EXIT

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$WORK/key.pem" 2>/dev/null
openssl pkey -in "$WORK/key.pem" -pubout -out "$WORK/pub.pem" 2>/dev/null
printf 'PK\003\004 not a real zip' > "$WORK/ext.zip"

KEY_B64=$(node -e '
const fs = require("fs")
const key = { client_email: "ci@peraci.iam.gserviceaccount.com", private_key: fs.readFileSync(process.argv[1], "utf8") }
process.stdout.write(Buffer.from(JSON.stringify(key)).toString("base64"))
' "$WORK/key.pem")

cat > "$WORK/stub.mjs" <<'STUB'
import { createServer } from 'node:http'
import { createVerify } from 'node:crypto'
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'

const [publicKeyPath, scenarioPath, logPath, portPath] = process.argv.slice(2)
const publicKey = readFileSync(publicKeyPath, 'utf8')
let fetchCount = 0

createServer((request, response) => {
    let body = ''
    request.on('data', chunk => (body += chunk))
    request.on('end', () => {
        const scenario = readFileSync(scenarioPath, 'utf8').trim()
        appendFileSync(logPath, `${request.method} ${request.url}\n`)
        const send = (status, json) => {
            response.writeHead(status, { 'Content-Type': 'application/json' })
            response.end(JSON.stringify(json))
        }
        if (request.url === '/token') {
            const assertion = new URLSearchParams(body).get('assertion') ?? ''
            const [header, claims, signature] = assertion.split('.')
            const valid = createVerify('RSA-SHA256')
                .update(`${header}.${claims}`)
                .verify(publicKey, signature ?? '', 'base64url')
            const scope = JSON.parse(Buffer.from(claims ?? 'e30', 'base64url')).scope
            if (!valid || scope !== 'https://www.googleapis.com/auth/chromewebstore') {
                return send(400, { error: 'invalid_grant' })
            }
            return send(200, { access_token: 'stub-token' })
        }
        if (request.headers.authorization !== 'Bearer stub-token') return send(401, {})
        if (request.url.endsWith(':upload')) {
            if (scenario === 'forbidden') return send(403, { error: { message: 'not a publisher member' } })
            const state = { ok: 'SUCCEEDED', failed: 'FAILED', async: 'IN_PROGRESS' }[scenario]
            return send(200, { uploadState: state, crxVersion: state === 'SUCCEEDED' ? '7.2.1.123' : undefined })
        }
        if (request.url.endsWith(':fetchStatus')) {
            fetchCount += 1
            return send(200, { lastAsyncUploadState: fetchCount < 2 ? 'IN_PROGRESS' : 'SUCCEEDED' })
        }
        send(404, {})
    })
}).listen(0, '127.0.0.1', function () {
    writeFileSync(portPath, String(this.address().port))
})
STUB

: > "$WORK/log"
: > "$WORK/all.log"
node "$WORK/stub.mjs" "$WORK/pub.pem" "$WORK/scenario" "$WORK/log" "$WORK/port" &
STUB_PID=$!
for _ in $(seq 50); do [ -s "$WORK/port" ] && break; sleep 0.1; done
BASE="http://127.0.0.1:$(cat "$WORK/port")"

failures=0

# $1 label  $2 scenario  $3 expected exit  $4 text the output must contain
# Remaining args are extra env assignments for this case.
run_case() {
    local label="$1" scenario="$2" want="$3" expect="$4"
    shift 4
    printf '%s' "$scenario" > "$WORK/scenario"
    : > "$WORK/log"
    local output status
    output=$(env CWS_SERVICE_ACCOUNT_BASE64="$KEY_B64" CWS_PUBLISHER_ID=pub CWS_ITEM_ID=item \
        CWS_API_BASE="$BASE" CWS_TOKEN_URL="$BASE/token" CWS_POLL_INTERVAL_MS=1 "$@" \
        node "$SCRIPT" "$WORK/ext.zip" 2>&1)
    status=$?
    cat "$WORK/log" >> "$WORK/all.log"
    if [ "$status" -eq "$want" ] && [[ "$output" == *"$expect"* ]]; then
        echo "  ok    ${label}"
    else
        echo "  FAIL  ${label}: expected exit ${want} and \"${expect}\", got ${status}"
        echo "        ${output}"
        failures=$((failures + 1))
    fi
}

run_case "uploads and reports the version" ok 0 "Uploaded 7.2.1.123 to publishers/pub/items/item as a draft"
run_case "polls an async upload until it succeeds" async 0 "as a draft"
run_case "fails when the store rejects the package" failed 1 "upload ended in state FAILED"
run_case "fails on an HTTP error from the store" forbidden 1 "failed (403)"
run_case "fails without an item id" ok 1 "CWS_ITEM_ID is not set" CWS_ITEM_ID=
run_case "fails on a key that is not base64 JSON" ok 1 "not a base64-encoded JSON key" CWS_SERVICE_ACCOUNT_BASE64=not-json

run_case "DRY_RUN uploads nothing" ok 0 "DRY_RUN: would upload" DRY_RUN=1
if [ -s "$WORK/log" ]; then
    echo "  FAIL  DRY_RUN made requests: $(tr '\n' ' ' < "$WORK/log")"
    failures=$((failures + 1))
fi

if grep -q ":publish" "$WORK/all.log"; then
    echo "  FAIL  the script called publish"
    failures=$((failures + 1))
fi

if [ "$failures" -gt 0 ]; then
    echo "${failures} case(s) failed"
    exit 1
fi
echo "all cases passed"
