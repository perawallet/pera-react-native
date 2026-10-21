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

// A fresh install on the welcome screen holds a token minted before enrolment,
// which the backend refuses by design. The refusal must read as enrolment still
// to do: no "Pera services unavailable" pill, no recorded failure, and no new
// mint until the install enrols.
//
// Opt in with E2E_INTEGRITY=1 against a bundle built with
// WEB_INTEGRITY_MINT_ENABLED, WEB_INTEGRITY_BEARER_ENABLED and
// WEB_INTEGRITY_ENROL_ENABLED on.
import {
    expect,
    test,
    chromium,
    type BrowserContext,
    type Page,
    type Route,
    type Worker,
} from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Playwright routes a service worker's own fetches only with this set before
// the browser launches, and only when this spec runs (see integrity-outage).
if (process.env.E2E_INTEGRITY) {
    process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1'
}

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)

const base64url = (value: string): string =>
    Buffer.from(value).toString('base64url')
const UNENROLLED_TOKEN = [
    base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    base64url(JSON.stringify({ platform: 'web', sub: 'install-e2e' })),
    'signature',
].join('.')

test.describe.configure({ mode: 'serial' })
test.skip(
    !process.env.E2E_INTEGRITY,
    'needs an integrity-enabled bundle (E2E_INTEGRITY=1)',
)

let context: BrowserContext
let serviceWorker: Worker
let page: Page
let attestCalls = 0

const answerIntegrity = async (route: Route): Promise<void> => {
    const { pathname } = new URL(route.request().url())
    if (pathname.endsWith('/challenge')) {
        await route.fulfill({
            json: { challenge: Buffer.alloc(32, 7).toString('base64') },
        })
        return
    }
    if (pathname.endsWith('/attest')) {
        attestCalls += 1
        await route.fulfill({
            json: {
                integrity_token: UNENROLLED_TOKEN,
                expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
            },
        })
        return
    }
    await route.fulfill({ status: 404, json: {} })
}

const readSession = (key: string) =>
    serviceWorker.evaluate(
        async name => (await chrome.storage.session.get(name))[name],
        key,
    )

test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        args: [
            `--disable-extensions-except=${dist}`,
            `--load-extension=${dist}`,
        ],
    })
    await context.route('**/api/v3/public/integrity/**', answerIntegrity)
    ;[serviceWorker] = context.serviceWorkers()
    if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker')
    }
    await serviceWorker.evaluate(async () => {
        await chrome.storage.session.clear()
    })
    const extensionId = new URL(serviceWorker.url()).host
    page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
})

test.afterAll(async () => {
    await context?.close()
})

test('the welcome screen mints an unenrolled token', async () => {
    await expect
        .poll(() => readSession('integrity:token'), { timeout: 20_000 })
        .toMatchObject({ integrityToken: UNENROLLED_TOKEN })
})

test('its refusal reads as enrolment still to do, never as an outage', async () => {
    const token = (await readSession('integrity:token')) as {
        expiresAt: string
    }
    await page.evaluate(
        tokenExpiresAt =>
            chrome.runtime.sendMessage({
                scope: 'pera-integrity-control',
                kind: 'token-rejected',
                tokenExpiresAt,
            }),
        Date.parse(token.expiresAt),
    )

    await expect
        .poll(() => readSession('integrity:enrol-needed'), { timeout: 10_000 })
        .toEqual(expect.any(Number))
    expect(await readSession('integrity:token')).toBeUndefined()
    expect(await readSession('integrity:last-failure')).toBeUndefined()
    expect(await readSession('integrity:backoff')).toBeUndefined()

    // Past the pending grace, the pill would have shown by now.
    await page.waitForTimeout(16_000)
    await expect(page.getByText('Pera services unavailable')).toHaveCount(0)
})

test('reopening the page mints nothing until the install enrols', async () => {
    const before = attestCalls
    await page.reload()
    await page.waitForTimeout(5000)

    expect(attestCalls).toBe(before)
    await expect(page.getByText('Pera services unavailable')).toHaveCount(0)
})
