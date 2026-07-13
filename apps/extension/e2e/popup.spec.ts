/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect, test } from '@playwright/test'

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)

test('popup boots the web bundle and round-trips storage', async () => {
    const context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        args: [
            `--disable-extensions-except=${dist}`,
            `--load-extension=${dist}`,
        ],
    })
    try {
        let [serviceWorker] = context.serviceWorkers()
        if (!serviceWorker) {
            serviceWorker = await context.waitForEvent('serviceworker')
        }
        const extensionId = new URL(serviceWorker.url()).host

        const page = await context.newPage()
        await page.goto(`chrome-extension://${extensionId}/popup.html`)

        await expect(page.getByTestId('bootstrap-status')).toHaveText(
            /storage ok/,
            { timeout: 20_000 },
        )
    } finally {
        await context.close()
    }
})
