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

// The keyless extension when its integrity service is down, end to end: the
// real worker mints against routed endpoints, records the failure, and the
// page's pill offers Retry; once the endpoints answer, Retry mints for real and
// the pill confirms the recovery.
//
// Opt in with E2E_INTEGRITY=1 against a bundle built with
// WEB_INTEGRITY_MINT_ENABLED, WEB_INTEGRITY_BEARER_ENABLED and
// WEB_INTEGRITY_ENROL_ENABLED on; CI's bundle leaves them off, so the worker
// never mints there.
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
// the browser launches. Only when this spec runs: specs share one worker, and
// the flag would change how every later spec's routes see the worker.
if (process.env.E2E_INTEGRITY) {
    process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1'
}

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)

test.describe.configure({ mode: 'serial' })
test.skip(
    !process.env.E2E_INTEGRITY,
    'needs an integrity-enabled bundle (E2E_INTEGRITY=1)',
)

let context: BrowserContext
let serviceWorker: Worker
let page: Page
let isIntegrityUp = false

const answerIntegrity = async (route: Route): Promise<void> => {
    if (!isIntegrityUp) {
        await route.fulfill({ status: 503, json: { error: 'down' } })
        return
    }
    const { pathname } = new URL(route.request().url())
    if (pathname.endsWith('/challenge')) {
        await route.fulfill({
            json: { challenge: Buffer.alloc(32, 7).toString('base64') },
        })
        return
    }
    if (pathname.endsWith('/attest')) {
        await route.fulfill({
            json: {
                integrity_token: 'e2e.integrity.token',
                expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
            },
        })
        return
    }
    await route.fulfill({ status: 404, json: {} })
}

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
    // Whatever the boot mint did before the route existed is discarded, so
    // the page's open is what starts the first routed mint.
    await serviceWorker.evaluate(async () => {
        await chrome.storage.session.remove([
            'integrity:token',
            'integrity:backoff',
            'integrity:last-failure',
        ])
    })
    const extensionId = new URL(serviceWorker.url()).host
    page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/expanded.html`)
})

test.afterAll(async () => {
    await context?.close()
})

test('a mint outage shows the pill with Retry', async () => {
    await expect(page.getByText('Pera services unavailable')).toBeVisible({
        timeout: 30_000,
    })
    await expect(page.getByText('Retry')).toBeVisible()
    const lastFailure = await serviceWorker.evaluate(
        async () =>
            (await chrome.storage.session.get('integrity:last-failure'))[
                'integrity:last-failure'
            ],
    )
    expect(lastFailure).toMatchObject({ phase: 'mint', isTransport: false })
})

test('Retry mints once the service answers, and the pill confirms it', async () => {
    isIntegrityUp = true

    await page.getByText('Retry').click()

    await expect(page.getByText('Pera services restored')).toBeVisible({
        timeout: 20_000,
    })
    await expect(page.getByText('Pera services restored')).toBeHidden({
        timeout: 10_000,
    })
    const token = await serviceWorker.evaluate(
        async () =>
            (await chrome.storage.session.get('integrity:token'))[
                'integrity:token'
            ],
    )
    expect(token).toMatchObject({ integrityToken: 'e2e.integrity.token' })
})
