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
//   CWS_API_BASE, CWS_TOKEN_URL, CWS_POLL_INTERVAL_MS  test overrides only

import { createSign } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

const SCOPE = 'https://www.googleapis.com/auth/chromewebstore'
const API_BASE =
    process.env.CWS_API_BASE ?? 'https://chromewebstore.googleapis.com'
const POLL_INTERVAL_MS = Number(process.env.CWS_POLL_INTERVAL_MS ?? 5000)
const POLL_ATTEMPTS = 60

const fail = message => {
    console.error(`upload-chrome-web-store: ${message}`)
    process.exit(1)
}

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
        process.env.CWS_TOKEN_URL ??
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
            `token exchange failed (${response.status}): ${body.error_description ?? body.error ?? 'no detail'}`,
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
        fail(`${step} failed (${response.status}): ${errorMessage(text)}`)
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

let state = upload.uploadState
for (
    let attempt = 0;
    state === 'IN_PROGRESS' && attempt < POLL_ATTEMPTS;
    attempt++
) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    const status = await call(
        token,
        'status check',
        'GET',
        `${API_BASE}/v2/${itemPath}:fetchStatus`,
    )
    state = status.lastAsyncUploadState
}

if (state !== 'SUCCEEDED') {
    fail(`upload ended in state ${state ?? 'unknown'}`)
}
console.log(
    `Uploaded ${upload.crxVersion ?? 'the package'} as a draft. Submit it for review in the Developer Dashboard.`,
)
