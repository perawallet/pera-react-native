#!/usr/bin/env bash
set -uo pipefail

# Drives upload-edge-add-ons.mjs against a local stand-in for the Microsoft Edge
# Add-ons API, which checks the v1.1 API-key headers and keeps the uploaded body.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/release/upload-edge-add-ons.mjs"
WORK=$(mktemp -d)
STUB_PID=""
trap '[ -n "$STUB_PID" ] && { kill "$STUB_PID"; wait "$STUB_PID"; } 2>/dev/null; rm -rf "$WORK"' EXIT

printf 'PK\003\004 not a real zip' > "$WORK/ext.zip"

cat > "$WORK/stub.mjs" <<'STUB'
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'

const [scenarioPath, logPath, portPath] = process.argv.slice(2)
const PACKAGE = '/v1/products/product-guid/submissions/draft/package'
let polls = 0

createServer((request, response) => {
    const chunks = []
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => {
        const scenario = readFileSync(scenarioPath, 'utf8').trim()
        appendFileSync(logPath, `${request.method} ${request.url}\n`)
        const send = (status, json, headers = {}) => {
            response.writeHead(status, { 'Content-Type': 'application/json', ...headers })
            response.end(json === undefined ? '' : JSON.stringify(json))
        }
        if (
            request.headers.authorization !== 'ApiKey edge-key' ||
            request.headers['x-clientid'] !== 'edge-client'
        ) {
            return send(401, { message: 'invalid credentials' })
        }
        if (request.method === 'POST' && request.url === PACKAGE) {
            writeFileSync(`${logPath}.body`, Buffer.concat(chunks))
            writeFileSync(`${logPath}.type`, request.headers['content-type'] ?? '')
            if (scenario === 'forbidden') return send(403, { message: 'not the product owner' })
            if (scenario === 'leaky') return send(404, { message: 'Product product-guid not found for client edge-client' })
            polls = 0
            const location = scenario === 'url-location' ? `https://example.invalid${PACKAGE}/operations/op-1` : 'op-1'
            return send(202, undefined, { Location: location })
        }
        if (request.method === 'GET' && request.url === `${PACKAGE}/operations/op-1`) {
            polls += 1
            if (scenario === 'failed') {
                return send(200, { id: 'op-1', status: 'Failed', message: 'Invalid package', errorCode: 'InvalidPackage', errors: ['manifest.json is missing'] })
            }
            if (scenario === 'stuck') return send(200, { id: 'op-1', status: 'InProgress' })
            const status = polls < 2 ? 'InProgress' : 'Succeeded'
            return send(200, { id: 'op-1', status, message: status === 'Succeeded' ? 'Successfully updated package to ext.zip' : null })
        }
        send(404, {})
    })
}).listen(0, '127.0.0.1', function () {
    writeFileSync(portPath, String(this.address().port))
})
STUB

: > "$WORK/log"
: > "$WORK/all.log"
: > "$WORK/all.out"
node "$WORK/stub.mjs" "$WORK/scenario" "$WORK/log" "$WORK/port" &
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
    rm -f "$WORK/log.body" "$WORK/log.type"
    local output status
    output=$(env EDGE_CLIENT_ID=edge-client EDGE_API_KEY=edge-key EDGE_PRODUCT_ID=product-guid \
        EDGE_API_BASE="$BASE" EDGE_POLL_INTERVAL_MS=1 "$@" \
        node "$SCRIPT" "$WORK/ext.zip" 2>&1)
    status=$?
    cat "$WORK/log" >> "$WORK/all.log"
    printf '%s\n' "$output" >> "$WORK/all.out"
    if [ "$status" -eq "$want" ] && [[ "$output" == *"$expect"* ]]; then
        echo "  ok    ${label}"
    else
        echo "  FAIL  ${label}: expected exit ${want} and \"${expect}\", got ${status}"
        echo "        ${output}"
        failures=$((failures + 1))
    fi
}

run_case "uploads the zip and polls until it succeeds" ok 0 "as the draft submission"
if ! cmp -s "$WORK/log.body" "$WORK/ext.zip" || [ "$(cat "$WORK/log.type")" != "application/zip" ]; then
    echo "  FAIL  the upload body or content type was wrong: $(cat "$WORK/log.type")"
    failures=$((failures + 1))
fi
run_case "reads an operation id given as a URL" url-location 0 "as the draft submission"
run_case "fails with the store's reasons when the package is rejected" failed 1 "upload ended in state Failed (InvalidPackage): Invalid package; manifest.json is missing"
run_case "fails on an HTTP error from the store" forbidden 1 "upload failed (403): not the product owner"
run_case "fails on a wrong API key" ok 1 "upload failed (401): invalid credentials" EDGE_API_KEY=wrong
run_case "fails without a product id" ok 1 "EDGE_PRODUCT_ID is not set" EDGE_PRODUCT_ID=
run_case "gives up after the poll limit and says the store may still finish" stuck 1 \
    "still processing after 3 checks" EDGE_POLL_ATTEMPTS=3
run_case "keeps the product and client ids out of a store error" leaky 1 \
    "upload failed (404): Product <redacted> not found for client <redacted>"

# The override exists for this stand-in; anywhere else it would send the API
# key off Microsoft.
run_case "refuses a non-loopback EDGE_API_BASE" ok 1 "EDGE_API_BASE may only point at a loopback address" EDGE_API_BASE=https://example.com
if [ -s "$WORK/log" ]; then
    echo "  FAIL  a refused EDGE_API_BASE still made requests: $(tr '\n' ' ' < "$WORK/log")"
    failures=$((failures + 1))
fi

run_case "DRY_RUN uploads nothing" ok 0 "DRY_RUN: would upload" DRY_RUN=1
if [ -s "$WORK/log" ]; then
    echo "  FAIL  DRY_RUN made requests: $(tr '\n' ' ' < "$WORK/log")"
    failures=$((failures + 1))
fi

# The product id, client id and API key are CI secrets.
if grep -qE "product-guid|edge-client|edge-key" "$WORK/all.out"; then
    echo "  FAIL  output carried a secret value: $(grep -E "product-guid|edge-client|edge-key" "$WORK/all.out" | head -1)"
    failures=$((failures + 1))
fi

if grep -qE "POST [^ ]*/submissions$" "$WORK/all.log"; then
    echo "  FAIL  the script called publish"
    failures=$((failures + 1))
fi

if [ "$failures" -gt 0 ]; then
    echo "${failures} case(s) failed"
    exit 1
fi
echo "all cases passed"
