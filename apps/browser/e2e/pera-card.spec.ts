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

// Smoke test for the card screen graph on web. Only PeraCardStackNavigator
// (intro, sign-in, onboarding) is exercised here; the dashboard and its
// transaction screens live in the Home tab's account stack and the money flows
// on the root stack. The card flow is NOT age-gated, unlike
// Discover/Swap/Onramp/Staking, so no age-gate
// helper is needed here.
import {
    expect,
    test,
    chromium,
    type BrowserContext,
    type Page,
} from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clickThroughPinPrompt, dismissPinPromptIfPresent } from './pin-prompt'

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)

test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let extensionId: string
let page: Page
let pageErrors: Error[]
const PASSWORD = 'e2e-pera-card-password-1'

// Without this, module-eval crashes in the bundle surface as bare selector
// timeouts with no sign of the real cause.
const trackPageErrors = (targetPage: Page): Error[] => {
    const errors: Error[] = []
    targetPage.on('pageerror', error => errors.push(error))
    return errors
}

// Account switcher -> Pera Card activate row -> PeraCardIntro.
const openPeraCardIntro = async (targetPage: Page): Promise<void> => {
    await clickThroughPinPrompt(
        targetPage,
        targetPage.getByTestId('account_selection_button'),
    )
    await clickThroughPinPrompt(
        targetPage,
        targetPage.getByTestId('pera_card_activate_button'),
    )
}

// 'PeraCard' is a RootStack sibling of 'TabBar', so it replaces the Home tab
// entirely while focused. The back button chains up through parent navigators,
// so two clicks return to Home from one level into the card stack.
//
// Native-stack keeps popped-from screens mounted during the transition, so
// several back buttons can coexist in the DOM — scope to the visible one or
// Playwright's strict mode fails.
const goBackToHome = async (targetPage: Page): Promise<void> => {
    const backButton = targetPage.locator(
        '[data-testid="navigation_back_button"]:visible',
    )
    await clickThroughPinPrompt(targetPage, backButton)
    await clickThroughPinPrompt(targetPage, backButton)
}

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

    // Seed the remote-config OVERRIDE, which getBooleanValue checks before
    // calling the service — so the flag reads true on first render. The
    // `isDebug || isStaging` fallback is unreliable in a networkless bundle.
    await serviceWorker.evaluate(async () => {
        await chrome.storage.local.set({
            'kv:remote-config-store': JSON.stringify({
                state: { configOverrides: { enable_pera_card: true } },
                version: 1,
            }),
        })
    })

    // Seed the PIN-security nudge as dismissed so it never mounts — it fires
    // on a wall-clock delay and lands mid-flow as a backdrop that swallows the
    // account-menu sheet these tests depend on.
    await serviceWorker.evaluate(async () => {
        await chrome.storage.local.set({
            'kv:settings-store': JSON.stringify({
                state: { preferences: { security_pin_setup_prompt: true } },
                version: 1,
            }),
        })
    })

    page = await context.newPage()
    pageErrors = trackPageErrors(page)
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
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

test.afterAll(async () => {
    await context.close()
})

// The activate row's visibility alone proves the remote-config override took
// effect and the entry point is wired; reaching the intro screen's CTA proves
// the route registered and the pre-card stack booted with no eval crash.
test('activation entry renders and navigates to the intro screen', async () => {
    await dismissPinPromptIfPresent(page)
    await clickThroughPinPrompt(
        page,
        page.getByTestId('account_selection_button'),
    )

    await expect(page.getByTestId('pera_card_activate_button')).toBeVisible({
        timeout: 20_000,
    })
    await clickThroughPinPrompt(
        page,
        page.getByTestId('pera_card_activate_button'),
    )

    await expect(page.getByTestId('pera_card_intro_create_button')).toBeVisible(
        { timeout: 20_000 },
    )
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// Proves the nested navigator advances to a second screen with no eval crash.
// Networkless — the form is never submitted against Baanx.
test('intro advances to the sign-in screen', async () => {
    await clickThroughPinPrompt(
        page,
        page.getByTestId('pera_card_intro_login_button'),
    )

    await expect(page.getByTestId('card-sign-in')).toBeVisible({
        timeout: 20_000,
    })
    await expect(page.getByTestId('card-sign-in-email-input')).toBeVisible()
    await expect(page.getByTestId('card-sign-in-password-input')).toBeVisible()
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// With `inAppWebView` false on web, Learn more goes through Linking.openURL,
// which RNW implements as window.open — so a real new page must appear.
// Test 2 left the app on CardSignIn, hence the pop back to Home first.
test('learn more opens a new browser tab, not a dead tap', async () => {
    await goBackToHome(page)
    await openPeraCardIntro(page)
    await expect(page.getByTestId('pera_card_intro_create_button')).toBeVisible(
        { timeout: 20_000 },
    )

    const [learnMorePage] = await Promise.all([
        context.waitForEvent('page', { timeout: 15_000 }),
        clickThroughPinPrompt(
            page,
            page.getByTestId('pera_card_intro_learn_more'),
        ),
    ])
    expect(learnMorePage.url()).toContain('perawallet.app/pera-card')
    await learnMorePage.close()
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// The definitive signal that the card graph never eval-crashed on boot or
// navigation anywhere in this serial run.
test('no uncaught errors across the pera card flow', () => {
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})
