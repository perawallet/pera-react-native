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

import { expect, test, chromium, type BrowserContext } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)

let context: BrowserContext

test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        args: [
            `--disable-extensions-except=${dist}`,
            `--load-extension=${dist}`,
        ],
    })
})

test.afterAll(async () => {
    await context.close()
})

// Two preconditions that token acquisition depends on and nothing else checks.
// Without the `notifications` permission, Notification.permission is 'default'
// and pushManager.subscribe({ userVisibleOnly: true }) throws NotAllowedError —
// and the FCM SDK hardcodes that flag. And getToken is handed
// navigator.serviceWorker.getRegistration(), which must resolve to the
// *background* worker, not some other registration.
test('extension pages can subscribe for user-visible push', async () => {
    let serviceWorker = context.serviceWorkers()[0]
    if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker')
    }
    const extensionId = new URL(serviceWorker.url()).host

    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/expanded.html`)

    const probe = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration()
        return {
            permission: Notification.permission,
            activeScript: registration?.active?.scriptURL ?? null,
            isRegistration: registration instanceof ServiceWorkerRegistration,
        }
    })

    expect(probe.permission).toBe('granted')
    expect(probe.isRegistration).toBe(true)
    expect(probe.activeScript).toBe(
        `chrome-extension://${extensionId}/background.js`,
    )
})
