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

test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let extensionId: string
const PASSWORD = 'e2e-deeplink-password-1'

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

test('popup deep-links onboarding to the expanded tab', async () => {
    const popup = await context.newPage()
    await popup.goto(`chrome-extension://${extensionId}/popup.html`)

    await popup.getByTestId('create-password-input').fill(PASSWORD)
    await popup.getByTestId('create-password-confirm-input').fill(PASSWORD)
    await popup.getByTestId('create-password-submit').click()

    // Popup must NOT show the onboarding stack — only the tab CTA.
    await expect(popup.getByTestId('open-onboarding-tab')).toBeVisible({
        timeout: 20_000,
    })

    const [expandedPage] = await Promise.all([
        context.waitForEvent('page'),
        popup.getByTestId('open-onboarding-tab').click(),
    ])
    expect(expandedPage.url()).toBe(
        `chrome-extension://${extensionId}/expanded.html`,
    )
    await expandedPage.close()
    await popup.close()
})

test('add-account deep-link lands on the real add-account screen', async () => {
    // Vault is already initialized (previous test), but no account exists
    // yet, so the shell is still in 'onboarding' state. Finish onboarding so
    // it reaches 'main' — the AddAccount deep-link route only exists there.
    const onboardingPage = await context.newPage()
    await onboardingPage.goto(`chrome-extension://${extensionId}/expanded.html`)

    await onboardingPage
        .getByTestId('onboarding_create_wallet_button')
        .click({ timeout: 20_000 })
    await expect(onboardingPage.getByTestId('terms_agree_button')).toBeVisible({
        timeout: 20_000,
    })
    await onboardingPage.getByTestId('terms_agree_button').click()
    await expect(
        onboardingPage.getByTestId('name_account_finish_button'),
    ).toBeVisible({ timeout: 45_000 })
    await onboardingPage.getByTestId('name_account_finish_button').click()
    await expect(onboardingPage.getByTestId('account_screen')).toBeVisible({
        timeout: 30_000,
    })
    await onboardingPage.close()

    // With an account now in place, opening expanded.html?flow=add-account
    // directly must land on the real AddAccount screen — not just carry the
    // URL param unconsumed. testID from AddAccountScreen.tsx.
    const addAccountPage = await context.newPage()
    await addAccountPage.goto(
        `chrome-extension://${extensionId}/expanded.html?flow=add-account`,
    )
    await expect(
        addAccountPage.getByTestId('add_account_close_button'),
    ).toBeVisible({ timeout: 20_000 })
    await addAccountPage.close()
})
