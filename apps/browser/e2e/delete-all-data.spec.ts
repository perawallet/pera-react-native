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

import {
    expect,
    test,
    chromium,
    type BrowserContext,
    type Page,
} from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clickThroughPinPrompt, settlePinPrompt } from './pin-prompt'

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)

// After "Remove All Data", every surface must land on create-password: the
// wipe destroys the vault, so the next wallet is sealed under a fresh master
// key rather than the old one and its old password. It also guards against a
// white screen on relaunch (AppShell once mounted a makeStyles hook outside
// its ThemeProvider and, with no error boundary, React unmounted the root).
// This fresh-context flow exercises the exact user path: onboard fully, wipe,
// reopen both surfaces, then set a new password.
test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let extensionId: string
const PASSWORD = 'e2e-test-password-1'
const NEW_PASSWORD = 'e2e-test-password-2'

test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        args: [
            `--disable-extensions-except=${dist}`,
            `--load-extension=${dist}`,
        ],
    })
    let [serviceWorker] = context.serviceWorkers()
    if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker')
    }
    extensionId = new URL(serviceWorker.url()).host
})

test.afterAll(async () => {
    await context.close()
})

// Fail fast on a render/module-eval crash instead of waiting out a selector
// timeout with no cause. A blank AppShell (the bug) surfaces here as an
// uncaught pageerror.
const trackPageErrors = (page: Page): Error[] => {
    const errors: Error[] = []
    page.on('pageerror', error => errors.push(error))
    return errors
}

test('data wipe destroys the vault: both surfaces ask for a new password (no white screen)', async () => {
    // --- Phase 1: full onboard on the expanded tab ---
    const page = await context.newPage()
    const pageErrors = trackPageErrors(page)
    await page.goto(`chrome-extension://${extensionId}/expanded.html`)

    await page.getByTestId('create-password-input').fill(PASSWORD)
    await page.getByTestId('create-password-confirm-input').fill(PASSWORD)
    await page.getByTestId('create-password-submit').click()

    await page
        .getByTestId('onboarding_create_wallet_button')
        .click({ timeout: 20_000 })
    await expect(page.getByTestId('terms_agree_button')).toBeVisible({
        timeout: 20_000,
    })
    await page.getByTestId('terms_agree_button').click()
    await expect(page.getByTestId('name_account_finish_button')).toBeVisible({
        timeout: 45_000,
    })
    await page.getByTestId('name_account_finish_button').click()
    await expect(page.getByTestId('account_screen')).toBeVisible({
        timeout: 30_000,
    })
    expect(pageErrors, 'onboarding threw an uncaught error').toEqual([])

    // Settle the security nudge before any sheet-opening test runs: while it
    // is pending it holds every new bottom-sheet presentation.
    await settlePinPrompt(page)

    // --- Phase 2: Menu → Settings → Remove All Data → confirm ---
    await clickThroughPinPrompt(page, page.getByTestId('tab_menu_button'))
    await expect(page.getByTestId('menu_screen')).toBeVisible({
        timeout: 10_000,
    })
    await clickThroughPinPrompt(page, page.getByTestId('menu_settings_button'))
    await expect(page.getByTestId('settings_screen')).toBeVisible({
        timeout: 10_000,
    })
    await clickThroughPinPrompt(
        page,
        page.getByTestId('settings_remove_all_accounts_button'),
    )
    await expect(
        page.getByTestId('settings_delete_all_confirm_button'),
    ).toBeVisible({ timeout: 10_000 })
    await clickThroughPinPrompt(
        page,
        page.getByTestId('settings_delete_all_confirm_button'),
    )

    // In-session the wipe routes to create-password, proving both that the
    // vault is gone and that the tree survived the destructive sequence.
    await expect(page.getByTestId('create-password-input')).toBeVisible({
        timeout: 20_000,
    })
    expect(pageErrors, 'delete-all threw an uncaught error').toEqual([])
    await page.close()

    // --- Phase 3: relaunch expanded.html → create-password ---
    const expanded = await context.newPage()
    const expandedErrors = trackPageErrors(expanded)
    await expanded.goto(`chrome-extension://${extensionId}/expanded.html`)
    // A white screen has no password input.
    await expect(expanded.getByTestId('create-password-input')).toBeVisible({
        timeout: 20_000,
    })
    expect(expandedErrors, 'expanded relaunch threw an uncaught error').toEqual(
        [],
    )
    await expanded.close()

    // --- Phase 4: relaunch popup.html → create-password, then a new vault ---
    const popup = await context.newPage()
    const popupErrors = trackPageErrors(popup)
    await popup.goto(`chrome-extension://${extensionId}/popup.html`)
    await expect(popup.getByTestId('create-password-input')).toBeVisible({
        timeout: 20_000,
    })
    // createVault refused while the old vault survived; reaching onboarding
    // proves a fresh one was minted.
    await popup.getByTestId('create-password-input').fill(NEW_PASSWORD)
    await popup.getByTestId('create-password-confirm-input').fill(NEW_PASSWORD)
    await popup.getByTestId('create-password-submit').click()
    await expect(
        popup.getByTestId('onboarding_create_wallet_button'),
    ).toBeVisible({ timeout: 20_000 })
    expect(popupErrors, 'popup relaunch threw an uncaught error').toEqual([])
    await popup.close()
})
