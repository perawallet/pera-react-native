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

// Cloud Backup restore from the onboarding import flow, on a fresh profile.
// Every backup request carries the device id, so a restore before the first
// account exists needs the onboarding surface to have registered one.
// Device registration and the backup manifest are stubbed: a 404 manifest is
// enough to prove the restore got past the device gate and reached the server.
import { expect, test, chromium, type Route } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { trackPageErrors } from './approval-surface'

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)
const PASSWORD = 'e2e-backup-restore-password-1'
const DEVICE_ID = '9000000000000000001'

// BIP-39 test vector; the backup it derives does not exist anywhere.
const PHRASE = [...Array(11).fill('abandon'), 'about']
const ENCRYPTION_KEY = 'c2FsdHNhbHRzYWx0c2FsdA=='

const DEVICES = /\/api\/v3\/devices$/
const BACKUP_MANIFEST = /\/api\/v3\/backup\/[^/]+\/manifest$/

test('restoring a backup during onboarding sends the registered device id', async () => {
    const context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        args: [
            `--disable-extensions-except=${dist}`,
            `--load-extension=${dist}`,
        ],
    })
    try {
        await context.route(DEVICES, async (route: Route) => {
            if (route.request().method() !== 'POST') return route.fallback()
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ...route.request().postDataJSON(),
                    id: DEVICE_ID,
                }),
            })
        })
        const manifestDeviceIds: (string | undefined)[] = []
        await context.route(BACKUP_MANIFEST, async (route: Route) => {
            manifestDeviceIds.push(route.request().headers()['x-device-id'])
            return route.fulfill({
                status: 404,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'BACKUP_NOT_FOUND' }),
            })
        })

        let [serviceWorker] = context.serviceWorkers()
        if (!serviceWorker) {
            serviceWorker = await context.waitForEvent('serviceworker')
        }
        const extensionId = new URL(serviceWorker.url()).host
        await serviceWorker.evaluate(async () => {
            await chrome.storage.local.set({
                'kv:remote-config-store': JSON.stringify({
                    state: { configOverrides: { enable_cloud_backup: true } },
                    version: 1,
                }),
            })
        })

        const page = await context.newPage()
        const pageErrors = trackPageErrors(page)
        await page.goto(`chrome-extension://${extensionId}/expanded.html`)
        await page.getByTestId('create-password-input').fill(PASSWORD)
        await page.getByTestId('create-password-confirm-input').fill(PASSWORD)
        await page.getByTestId('create-password-submit').click()
        await page
            .getByTestId('onboarding_import_account_button')
            .click({ timeout: 20_000 })
        await page.getByTestId('terms_agree_button').click({ timeout: 20_000 })
        await page
            .getByTestId('import_account_options_cloud_backup_button')
            .click({ timeout: 20_000 })
        await page
            .getByTestId('cloud_backup_restore_sheet_manual')
            .click({ timeout: 20_000 })

        for (const [index, word] of PHRASE.entries()) {
            await page
                .getByTestId(`cloud_backup_restore_word_input_${index}`)
                .fill(word)
        }
        await page
            .getByTestId('cloud_backup_restore_passphrase_continue')
            .click()
        await page
            .getByTestId('cloud_backup_restore_key_input')
            .fill(ENCRYPTION_KEY)
        await page.getByTestId('cloud_backup_restore_key_button').click()

        // Argon2id at 256 MiB runs before the first request.
        await expect(
            page.getByText('No backup found for these credentials.'),
        ).toBeVisible({ timeout: 60_000 })
        expect(manifestDeviceIds).toEqual([DEVICE_ID])
        expect(pageErrors, 'page threw an uncaught error').toEqual([])
    } finally {
        await context.close()
    }
})
