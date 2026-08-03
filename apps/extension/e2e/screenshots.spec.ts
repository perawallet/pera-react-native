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

// Visual-fidelity harness (M3 human requirement): captures the key screens
// as PNG artifacts for BY-EYE review against the mobile app each milestone.
// Deliberately NOT pixel-diffed in CI — theme/copy churn would make that
// flaky; the artifact upload makes review cheap instead.
import {
    expect,
    test,
    chromium,
    type BrowserContext,
    type Page,
} from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

const dir = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(dir, '../dist')
const shots = path.resolve(dir, '../screenshots')

test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let extensionId: string
const PASSWORD = 'e2e-screenshot-password-1'

const POPUP = { width: 360, height: 600 }

test.beforeAll(async () => {
    mkdirSync(shots, { recursive: true })
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

const trackPageErrors = (page: Page): Error[] => {
    const errors: Error[] = []
    page.on('pageerror', error => errors.push(error))
    return errors
}

const capture = async (page: Page, name: string): Promise<void> => {
    await page.evaluate(async () => document.fonts.ready)
    // The sheet's Modal fades in, and capturing mid-fade washes out colors —
    // an enabled dark button reads as light gray at 50% opacity — so
    // `animations: 'disabled'` finishes transitions first.
    //
    // Static terms render in an opaque-origin sandboxed iframe that loads
    // independently of React paint. `frame.contentDocument` is always null
    // cross-origin, so a page.evaluate poll never resolves; frameLocator goes
    // through CDP instead and isn't blocked.
    const staticFrame = page.locator('iframe[title="static-content"]')
    if ((await staticFrame.count()) > 0) {
        await page
            .frameLocator('iframe[title="static-content"]')
            .locator('body')
            .waitFor({ state: 'attached', timeout: 10_000 })
    }
    await page.screenshot({
        path: path.join(shots, `${name}.png`),
        animations: 'disabled',
    })
}

test('captures the key screens', async () => {
    const page = await context.newPage()
    const pageErrors = trackPageErrors(page)
    await page.setViewportSize(POPUP)
    await page.goto(`chrome-extension://${extensionId}/expanded.html`)

    // --- Vault: create password ---
    await expect(page.getByTestId('create-password-input')).toBeVisible({
        timeout: 20_000,
    })
    await capture(page, '01-create-password')

    await page.getByTestId('create-password-input').fill(PASSWORD)
    await page.getByTestId('create-password-confirm-input').fill(PASSWORD)
    await page.getByTestId('create-password-submit').click()

    // --- Onboarding: tap "Create wallet" button ---
    await expect(
        page.getByTestId('onboarding_create_wallet_button'),
    ).toBeVisible({ timeout: 20_000 })
    await capture(page, '02-onboarding-home')
    await page.getByTestId('onboarding_create_wallet_button').click()

    expect(pageErrors, 'page threw an uncaught error').toEqual([])

    // --- Terms gate (M3) ---
    await expect(page.getByTestId('terms_agree_button')).toBeVisible({
        timeout: 20_000,
    })
    await capture(page, '03-terms-sheet')
    await page.getByTestId('terms_agree_button').click()

    // --- Name account: accept default name and finish ---
    await expect(page.getByTestId('name_account_finish_button')).toBeVisible({
        timeout: 45_000,
    })
    await capture(page, '04-name-account')
    await page.getByTestId('name_account_finish_button').click()

    // --- Home: real portfolio screen ---
    await expect(page.getByTestId('account_screen')).toBeVisible({
        timeout: 30_000,
    })
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
    await capture(page, '05-portfolio-home')

    // --- Menu ---
    await page.getByTestId('tab_menu_button').click()
    await expect(page.getByTestId('menu_screen')).toBeVisible({
        timeout: 20_000,
    })
    await capture(page, '06-menu')

    // --- Settings ---
    await page.getByTestId('menu_settings_button').click()
    await expect(page.getByTestId('settings_screen')).toBeVisible({
        timeout: 20_000,
    })
    await capture(page, '07-settings')

    // --- Lock -> unlock screen ---
    const [serviceWorker] = context.serviceWorkers()
    await serviceWorker.evaluate(async () => {
        await chrome.storage.session.remove('vault:master-key')
    })
    await page.reload()
    await expect(page.getByTestId('unlock-password-input')).toBeVisible({
        timeout: 20_000,
    })
    await capture(page, '08-unlock')

    await page.close()
})
