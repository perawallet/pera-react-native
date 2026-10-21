#!/usr/bin/env bash
set -uo pipefail

# Drives upload-chrome-web-store.mjs against a local stand-in for Google's token
# endpoint and the Chrome Web Store API. The stand-in verifies the JWT against a
# throwaway key, and the uploaded CRX is checked against a throwaway signing key,
# so a signing regression fails here rather than on a release tag.

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/release/upload-chrome-web-store.mjs"
WORK=$(mktemp -d)
STUB_PID=""
trap '[ -n "$STUB_PID" ] && { kill "$STUB_PID"; wait "$STUB_PID"; } 2>/dev/null; rm -rf "$WORK"' EXIT

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$WORK/key.pem" 2>/dev/null
openssl pkey -in "$WORK/key.pem" -pubout -out "$WORK/pub.pem" 2>/dev/null
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$WORK/crx-key.pem" 2>/dev/null
openssl pkey -in "$WORK/crx-key.pem" -pubout -out "$WORK/crx-pub.pem" 2>/dev/null
CRX_KEY_B64=$(base64 < "$WORK/crx-key.pem" | tr -d '\n')
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
    const chunks = []
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => {
        const body = Buffer.concat(chunks).toString()
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
            writeFileSync(`${logPath}.body`, Buffer.concat(chunks))
            writeFileSync(
                `${logPath}.headers`,
                JSON.stringify({
                    protocol: request.headers['x-goog-upload-protocol'],
                    fileName: request.headers['x-goog-upload-file-name'],
                }),
            )
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
: > "$WORK/all.out"
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
    rm -f "$WORK/log.body" "$WORK/log.headers"
    local output status
    output=$(env CWS_SERVICE_ACCOUNT_BASE64="$KEY_B64" CWS_PUBLISHER_ID=pub CWS_ITEM_ID=item \
        CWS_API_BASE="$BASE" CWS_TOKEN_URL="$BASE/token" CWS_POLL_INTERVAL_MS=1 "$@" \
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

run_case "uploads and reports the version" ok 0 "Uploaded 7.2.1.123 as a draft"
run_case "polls an async upload until it succeeds" async 0 "as a draft"
run_case "fails when the store rejects the package" failed 1 "upload ended in state FAILED"
run_case "fails on an HTTP error from the store" forbidden 1 "upload failed (403): not a publisher member"
run_case "fails without an item id" ok 1 "CWS_ITEM_ID is not set" CWS_ITEM_ID=
run_case "fails on a key that is not base64 JSON" ok 1 "not a base64-encoded JSON key" CWS_SERVICE_ACCOUNT_BASE64=not-json

run_case "uploads the zip as is without a signing key" ok 0 "as a draft"
if ! cmp -s "$WORK/log.body" "$WORK/ext.zip" || [ "$(cat "$WORK/log.headers")" != '{}' ]; then
    echo "  FAIL  the zip upload was altered or carried CRX headers: $(cat "$WORK/log.headers")"
    failures=$((failures + 1))
fi

run_case "uploads a signed CRX with a signing key" ok 0 "as a draft" CWS_CRX_SIGNING_KEY_BASE64="$CRX_KEY_B64"
# Parses the CRX3 the stand-in received and checks it the way the store does:
# the one RSA proof is for the configured key, its signature covers the header
# data and the zip, the crx id is derived from that key, and the zip is intact.
if ! node --input-type=module - "$WORK/log.body" "$WORK/crx-pub.pem" "$WORK/ext.zip" "$WORK/log.headers" <<'VERIFY'; then
import { createHash, createPublicKey, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'

const [crxPath, publicKeyPath, zipPath, headersPath] = process.argv.slice(2)
const crx = readFileSync(crxPath)
const expectedKey = createPublicKey(readFileSync(publicKeyPath)).export({ type: 'spki', format: 'der' })
const assert = (condition, message) => {
    if (!condition) {
        console.log(`        ${message}`)
        process.exit(1)
    }
}

const readVarint = (bytes, offset) => {
    let value = 0
    let shift = 0
    for (;;) {
        const byte = bytes[offset++]
        value += (byte & 0x7f) * 2 ** shift
        if (byte < 0x80) return [value, offset]
        shift += 7
    }
}
const fields = bytes => {
    const out = []
    for (let offset = 0; offset < bytes.length; ) {
        const [tag, afterTag] = readVarint(bytes, offset)
        const [length, start] = readVarint(bytes, afterTag)
        assert((tag & 7) === 2, `unexpected wire type in field ${tag >> 3}`)
        out.push([tag >> 3, bytes.subarray(start, start + length)])
        offset = start + length
    }
    return out
}

assert(crx.subarray(0, 4).toString() === 'Cr24', 'no Cr24 magic')
assert(crx.readUInt32LE(4) === 3, 'not CRX version 3')
const headerLength = crx.readUInt32LE(8)
const header = fields(crx.subarray(12, 12 + headerLength))
const zip = crx.subarray(12 + headerLength)
assert(Buffer.compare(zip, readFileSync(zipPath)) === 0, 'the zip inside the CRX differs')

const proofs = header.filter(([number]) => number === 2).map(([, proof]) => new Map(fields(proof)))
const signedData = header.find(([number]) => number === 10000)?.[1]
assert(proofs.length === 1 && signedData, 'expected one RSA proof and signed header data')
assert(Buffer.compare(proofs[0].get(1), expectedKey) === 0, 'the proof is not for the configured key')

const crxId = new Map(fields(signedData)).get(1)
assert(
    Buffer.compare(crxId, createHash('sha256').update(expectedKey).digest().subarray(0, 16)) === 0,
    'the crx id is not derived from the key',
)
const length = Buffer.alloc(4)
length.writeUInt32LE(signedData.length)
const message = Buffer.concat([Buffer.from('CRX3 SignedData\x00'), length, signedData, zip])
assert(verify('sha256', message, createPublicKey(readFileSync(publicKeyPath)), proofs[0].get(2)), 'the signature does not verify')

const headers = JSON.parse(readFileSync(headersPath, 'utf8'))
assert(headers.protocol === 'raw' && headers.fileName === 'ext.crx', `wrong upload headers: ${JSON.stringify(headers)}`)
VERIFY
    echo "  FAIL  the uploaded CRX did not verify"
    failures=$((failures + 1))
fi

run_case "fails on a signing key that is not an RSA PEM" ok 1 "not a base64-encoded RSA private key" CWS_CRX_SIGNING_KEY_BASE64=bm90LWEta2V5
run_case "DRY_RUN uploads nothing" ok 0 "DRY_RUN: would upload" DRY_RUN=1
run_case "DRY_RUN reports a signed CRX" ok 0 "as a signed CRX" DRY_RUN=1 CWS_CRX_SIGNING_KEY_BASE64="$CRX_KEY_B64"
if [ -s "$WORK/log" ]; then
    echo "  FAIL  DRY_RUN made requests: $(tr '\n' ' ' < "$WORK/log")"
    failures=$((failures + 1))
fi

# The publisher and item ids and the account email are CI secrets.
if grep -qE "publishers/|items/|ci@peraci" "$WORK/all.out"; then
    echo "  FAIL  output carried a secret value: $(grep -E "publishers/|items/|ci@peraci" "$WORK/all.out" | head -1)"
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
