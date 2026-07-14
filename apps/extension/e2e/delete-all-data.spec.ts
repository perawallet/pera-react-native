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

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)

// Reproduces the M3 white-screen regression: after "Remove All Data", every
// relaunch (popup + expanded) has to re-enter onboarding instead of blanking.
// The crash was AppShell mounting a makeStyles hook outside its own
// ThemeProvider — `theme.colors` threw and, with no error boundary, React
// unmounted the whole root. This fresh-context flow exercises the exact
// user path: onboard fully, wipe, then reopen both surfaces.
test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let extensionId: string
const PASSWORD = 'e2e-test-password-1'

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

test('data wipe then relaunch re-enters onboarding on both surfaces (no white screen)', async () => {
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

    // --- Phase 2: Menu → Settings → Remove All Data → confirm ---
    await page.getByTestId('tab_menu_button').click()
    await expect(page.getByTestId('menu_screen')).toBeVisible({
        timeout: 10_000,
    })
    await page.getByTestId('menu_settings_button').click()
    await expect(page.getByTestId('settings_screen')).toBeVisible({
        timeout: 10_000,
    })
    await page.getByTestId('settings_remove_all_accounts_button').click()
    await expect(
        page.getByTestId('settings_delete_all_confirm_button'),
    ).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('settings_delete_all_confirm_button').click()

    // In-session the wipe routes straight back to onboarding — the welcome
    // screen's "Create wallet" CTA must reappear, proving the tree survived
    // the destructive sequence (clearDatabase + clearKeystore + store resets).
    await expect(
        page.getByTestId('onboarding_create_wallet_button'),
    ).toBeVisible({ timeout: 20_000 })
    expect(pageErrors, 'delete-all threw an uncaught error').toEqual([])
    await page.close()

    // --- Phase 3: relaunch expanded.html → real onboarding stack ---
    const expanded = await context.newPage()
    const expandedErrors = trackPageErrors(expanded)
    await expanded.goto(`chrome-extension://${extensionId}/expanded.html`)
    // The expanded surface mounts the OnboardingStackNavigator, whose welcome
    // screen exposes the "Create wallet" CTA. A white screen has neither.
    await expect(
        expanded.getByTestId('onboarding_create_wallet_button'),
    ).toBeVisible({ timeout: 20_000 })
    expect(expandedErrors, 'expanded relaunch threw an uncaught error').toEqual(
        [],
    )
    await expanded.close()

    // --- Phase 4: relaunch popup.html → "opens in a new tab" prompt ---
    const popup = await context.newPage()
    const popupErrors = trackPageErrors(popup)
    await popup.goto(`chrome-extension://${extensionId}/popup.html`)
    // The popup is too small for blur-fragile onboarding, so it shows the
    // OnboardingTabPrompt CTA that opens the expanded tab.
    await expect(popup.getByTestId('open-onboarding-tab')).toBeVisible({
        timeout: 20_000,
    })
    expect(popupErrors, 'popup relaunch threw an uncaught error').toEqual([])
    await popup.close()
})
