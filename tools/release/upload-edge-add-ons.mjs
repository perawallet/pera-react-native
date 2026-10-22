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

// node tools/release/upload-edge-add-ons.mjs <zip>
//
// Uploads an extension zip to its Microsoft Edge Add-ons product as the draft
// submission (Add-ons API v1.1). It never publishes: submitting for review
// stays a manual step in Partner Center, as for the Chrome Web Store.
//
// Env:
//   EDGE_CLIENT_ID, EDGE_API_KEY  from Partner Center > Microsoft Edge > Publish API;
//                                 the API key expires, and its date is shown there
//   EDGE_PRODUCT_ID               the extension's product id
//   DRY_RUN                       when "1": check inputs, print the target, upload nothing
//   EDGE_API_BASE, EDGE_POLL_INTERVAL_MS  test overrides only; the URL must be
//                                         loopback

import { readFile } from 'node:fs/promises'

const fail = message => {
    console.error(`upload-edge-add-ons: ${message}`)
    process.exit(1)
}

// Test overrides: anything but a loopback address is refused, so a stray CI
// variable cannot send the API key elsewhere.
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

const API_BASE =
    loopbackOverride('EDGE_API_BASE') ??
    'https://api.addons.microsoftedge.microsoft.com'
const POLL_INTERVAL_MS = Number(process.env.EDGE_POLL_INTERVAL_MS ?? 5000)
const POLL_ATTEMPTS = 60

const zipPath = process.argv[2]
const {
    EDGE_CLIENT_ID: clientId,
    EDGE_API_KEY: apiKey,
    EDGE_PRODUCT_ID: productId,
} = process.env

if (!zipPath) fail('no zip path given')
for (const [name, value] of Object.entries({
    EDGE_CLIENT_ID: clientId,
    EDGE_API_KEY: apiKey,
    EDGE_PRODUCT_ID: productId,
})) {
    if (!value) fail(`${name} is not set`)
}

const zip = await readFile(zipPath).catch(() => fail(`cannot read ${zipPath}`))

if (process.env.DRY_RUN === '1') {
    console.log(
        `DRY_RUN: would upload ${zipPath} (${zip.length} bytes) to the configured product`,
    )
    process.exit(0)
}

const draftPackage = `${API_BASE}/v1/products/${productId}/submissions/draft/package`
const auth = { Authorization: `ApiKey ${apiKey}`, 'X-ClientID': clientId }

const errorMessage = text => {
    try {
        const body = JSON.parse(text)
        return body.message ?? body.error?.message ?? 'no detail'
    } catch {
        return 'no detail'
    }
}

// Messages name the step, never the URL or response headers: both carry the
// product id, a CI secret.
const upload = await fetch(draftPackage, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/zip' },
    body: zip,
})
if (upload.status !== 202) {
    fail(
        `upload failed (${upload.status}): ${errorMessage(await upload.text())}`,
    )
}
// The docs give the header as the bare operation id; take the last segment in
// case it ever arrives as a URL.
const operationId = upload.headers.get('location')?.split('/').pop()
if (!operationId) fail('upload accepted without an operation id')

let operation = { status: 'InProgress' }
for (
    let attempt = 0;
    operation.status === 'InProgress' && attempt < POLL_ATTEMPTS;
    attempt++
) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    const response = await fetch(`${draftPackage}/operations/${operationId}`, {
        headers: auth,
    })
    const text = await response.text()
    if (!response.ok) {
        fail(`status check failed (${response.status}): ${errorMessage(text)}`)
    }
    operation = JSON.parse(text)
}

if (operation.status !== 'Succeeded') {
    const errors = (operation.errors ?? [])
        .map(error => (typeof error === 'string' ? error : error?.message))
        .filter(Boolean)
    fail(
        `upload ended in state ${operation.status ?? 'unknown'}: ${[operation.message, ...errors].filter(Boolean).join('; ') || 'no detail'}`,
    )
}
console.log(
    'Uploaded the package as the draft submission. Submit it for review in Partner Center.',
)
