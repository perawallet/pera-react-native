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

test('offscreen host runs migrations and serves queries over chrome.runtime', async () => {
    let [serviceWorker] = context.serviceWorkers()
    if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker')
    }

    // Terminal-state assertion: ready:true AND migrated schema visible.
    // 'pera-db' literals below must equal DB_SCOPE
    // (extensions/platform-chrome/src/database/protocol.ts).
    await expect(async () => {
        const result = await serviceWorker.evaluate(async () => {
            const pong = (await chrome.runtime.sendMessage({
                scope: 'pera-db',
                kind: 'ping',
            })) as { ok: boolean; ready: boolean } | undefined
            if (!pong?.ready) return { ready: false as const }
            const tags = (await chrome.runtime.sendMessage({
                scope: 'pera-db',
                kind: 'exec',
                name: 'pera.db',
                sql: 'SELECT tag FROM __drizzle_migrations ORDER BY tag',
                params: [],
                method: 'values',
            })) as { ok: boolean; rows: unknown[][] }
            return { ready: true as const, tags }
        })
        expect(result.ready).toBe(true)
        if (result.ready) {
            expect(result.tags.ok).toBe(true)
            expect(result.tags.rows.length).toBeGreaterThanOrEqual(2)
            expect(result.tags.rows[0][0]).toBe('0000_initial')
        }
    }).toPass({ timeout: 60_000 })
})
