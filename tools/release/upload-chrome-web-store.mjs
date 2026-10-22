/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// node tools/release/upload-chrome-web-store.mjs <zip|crx>
//
// Uploads an extension package to its Chrome Web Store item as the pending draft.
// It never publishes: submitting for review stays a manual step in the
// Developer Dashboard, as promotion to production is for the mobile stores.
// A .crx (tools/release/sign-extension-crx.mjs) is sent with the two
// X-Goog-Upload headers Google documents for verified CRX uploads; a .zip goes
// as a plain POST body.
//
// Env:
//   CWS_SERVICE_ACCOUNT_BASE64  service-account JSON key, base64; its email must
//                               be added under Account in the Developer Dashboard
//   CWS_PUBLISHER_ID, CWS_ITEM_ID
//   DRY_RUN                     when "1": check inputs, print the target, upload nothing
//   CWS_API_BASE, CWS_TOKEN_URL, CWS_POLL_INTERVAL_MS, CWS_POLL_ATTEMPTS  test
//                               overrides only; the two URLs must be loopback

import { createSign } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

const fail = message => {
    console.error(`upload-chrome-web-store: ${message}`)
    process.exit(1)
}

// Test overrides: anything but a loopback address is refused, so a stray CI
// variable cannot send the bearer token or the signed JWT elsewhere.
const loopbackOverride = name => {
    const value = process.env[name]
    if (!value) return undefined
    let hostname
    try {
        hostname = new URL(value).hostname
    } catch {
        fail(`${name} may only point at a loopback address`)
    }
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(hostname)) {
        fail(`${name} may only point at a loopback address`)
    }
    return value
}

const SCOPE = 'https://www.googleapis.com/auth/chromewebstore'
const API_BASE =
    loopbackOverride('CWS_API_BASE') ?? 'https://chromewebstore.googleapis.com'
const TOKEN_URL_OVERRIDE = loopbackOverride('CWS_TOKEN_URL')
const POLL_INTERVAL_MS = Number(process.env.CWS_POLL_INTERVAL_MS ?? 5000)
const POLL_ATTEMPTS = Number(process.env.CWS_POLL_ATTEMPTS ?? 60)

const packagePath = process.argv[2]
const {
    CWS_SERVICE_ACCOUNT_BASE64: keyBase64,
    CWS_PUBLISHER_ID: publisherId,
    CWS_ITEM_ID: itemId,
} = process.env

if (!packagePath) fail('no package path given')
for (const [name, value] of Object.entries({
    CWS_SERVICE_ACCOUNT_BASE64: keyBase64,
    CWS_PUBLISHER_ID: publisherId,
    CWS_ITEM_ID: itemId,
})) {
    if (!value) fail(`${name} is not set`)
}

let key
try {
    key = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf8'))
} catch {
    fail('CWS_SERVICE_ACCOUNT_BASE64 is not a base64-encoded JSON key')
}
if (!key.client_email || !key.private_key) {
    fail('the service-account key has no client_email or private_key')
}

// Store and token errors can name the item or the account; neither reaches the log.
const scrub = text =>
    [publisherId, itemId, key.client_email].reduce(
        (out, secret) => out.replaceAll(secret, '<redacted>'),
        String(text).replace(/publishers\/[^/\s"]+\/items\/[^/\s"]+/g, '<item>'),
    )

const packageBytes = await readFile(packagePath).catch(() =>
    fail(`cannot read ${packagePath}`),
)
const itemPath = `publishers/${publisherId}/items/${itemId}`

if (process.env.DRY_RUN === '1') {
    console.log(
        `DRY_RUN: would upload ${packagePath} (${packageBytes.length} bytes) to the configured item`,
    )
    process.exit(0)
}

const base64Url = value =>
    Buffer.from(
        typeof value === 'string' ? value : JSON.stringify(value),
    ).toString('base64url')

const accessToken = async () => {
    const tokenUrl =
        TOKEN_URL_OVERRIDE ??
        key.token_uri ??
        'https://oauth2.googleapis.com/token'
    const now = Math.floor(Date.now() / 1000)
    const unsigned = `${base64Url({ alg: 'RS256', typ: 'JWT' })}.${base64Url({
        iss: key.client_email,
        scope: SCOPE,
        aud: tokenUrl,
        iat: now,
        exp: now + 600,
    })}`
    const signature = createSign('RSA-SHA256')
        .update(unsigned)
        .sign(key.private_key, 'base64url')
    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: `${unsigned}.${signature}`,
        }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !body.access_token) {
        fail(
            `token exchange failed (${response.status}): ${scrub(body.error_description ?? body.error ?? 'no detail')}`,
        )
    }
    return body.access_token
}

const errorMessage = text => {
    try {
        return JSON.parse(text).error?.message ?? 'no detail'
    } catch {
        return 'no detail'
    }
}

// Messages name the step and Google's error text, never the URL: it carries
// the publisher and item ids, which are CI secrets.
const call = async (token, step, method, url, body, headers = {}) => {
    const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...headers },
        body,
    })
    const text = await response.text()
    if (!response.ok)
        fail(`${step} failed (${response.status}): ${scrub(errorMessage(text))}`)
    return JSON.parse(text)
}

// Google documents these two headers for a CRX upload only.
const uploadHeaders = packagePath.endsWith('.crx')
    ? {
          'X-Goog-Upload-Protocol': 'raw',
          'X-Goog-Upload-File-Name': basename(packagePath),
      }
    : {}

const token = await accessToken()
const upload = await call(
    token,
    'upload',
    'POST',
    `${API_BASE}/upload/v2/${itemPath}:upload`,
    packageBytes,
    uploadHeaders,
)

// What the store says beside the state, without the item's resource name, id
// and public key.
const detail = body =>
    scrub(
        JSON.stringify(
            Object.fromEntries(
                Object.entries(body ?? {}).filter(
                    ([field]) => !['name', 'itemId', 'publicKey'].includes(field),
                ),
            ),
        ),
    )

// fetchStatus can answer before the async upload is on record, with NOT_FOUND
// or no state at all; both mean wait, as IN_PROGRESS does.
const isPending = (value, polled) =>
    value === 'IN_PROGRESS' ||
    value === 'UPLOAD_IN_PROGRESS' ||
    (polled && (value === undefined || value === 'NOT_FOUND'))

let last = upload
let state = upload.uploadState
let polled = false
for (
    let attempt = 0;
    isPending(state, polled) && attempt < POLL_ATTEMPTS;
    attempt++
) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    const status = await call(
        token,
        'status check',
        'GET',
        `${API_BASE}/v2/${itemPath}:fetchStatus`,
    )
    last = status
    state = status.lastAsyncUploadState
    polled = true
}

if (isPending(state, polled)) {
    fail(
        `upload still processing after ${POLL_ATTEMPTS} checks; the store may yet finish it, so check the Developer Dashboard before uploading by hand`,
    )
}
if (state !== 'SUCCEEDED') {
    fail(`upload ended in state ${state ?? 'unknown'}: ${detail(last)}`)
}
console.log(
    `Uploaded ${upload.crxVersion ?? 'the package'} as a draft. Submit it for review in the Developer Dashboard.`,
)
