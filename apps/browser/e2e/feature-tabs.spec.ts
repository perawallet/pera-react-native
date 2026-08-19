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

// Smoke test for the Swap and Fund tabs, the Staking route, and the Developer
// Settings row on web. Network access is not assumed — every assertion accepts
// the networkless terminal state where one exists.
import {
    expect,
    test,
    chromium,
    type BrowserContext,
    type Page,
} from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    clickThroughPinPrompt,
    dismissPinPromptIfPresent,
    settlePinPrompt,
} from './pin-prompt'

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)

test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let extensionId: string
let page: Page
let pageErrors: Error[]
const PASSWORD = 'e2e-feature-tabs-password-1'

// Without this, module-eval crashes in the bundle surface as bare selector
// timeouts with no sign of the real cause.
const trackPageErrors = (targetPage: Page): Error[] => {
    const errors: Error[] = []
    targetPage.on('pageerror', error => errors.push(error))
    return errors
}

// Web's age-gate resolves to 'unknown'/'manual', so the first focus of a gated
// screen offers the self-declaration sheet. The result persists, so only one
// test pays the cost — but call it at every gated entry point, since slice
// order isn't guaranteed.
const passAgeGateIfOffered = async (targetPage: Page): Promise<void> => {
    const declaration = targetPage.getByTestId('age-gate-declaration')
    const offered = await declaration
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false)
    if (offered) {
        await clickThroughPinPrompt(
            targetPage,
            targetPage.getByText('I am 18 or older', { exact: true }),
        )
    }
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

    // Settle the security nudge before any sheet-opening test runs: while it
    // is pending it holds every new bottom-sheet presentation.
    await settlePinPrompt(page)
})

test.afterAll(async () => {
    await context.close()
})

// Reaching the real SwapForm proves the swap graph booted with no eval crash.
// 'swap-button' only renders once a quote resolves, which needs a typed amount
// AND a network round-trip — so 'swap-pay-input', which is unconditional, is
// the real proof. Accept 'swap-button' too in case a quote does resolve.
test('swap tab passes the age gate and renders the swap form', async () => {
    await dismissPinPromptIfPresent(page)
    await clickThroughPinPrompt(page, page.getByTestId('tab_swap_button'))
    await passAgeGateIfOffered(page)

    await expect(page.getByTestId('swap-intro-start-button')).toBeVisible({
        timeout: 20_000,
    })
    await clickThroughPinPrompt(
        page,
        page.getByTestId('swap-intro-start-button'),
    )

    const payInput = page.getByTestId('swap-pay-input')
    const swapButton = page.getByTestId('swap-button')
    await expect(payInput.or(swapButton)).toBeVisible({
        timeout: 20_000,
    })
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// Either terminal state — the real mainnet form or the testnet placeholder —
// proves the onramp graph booted on web.
test('fund tab renders the onramp form or the mainnet-only placeholder', async () => {
    await dismissPinPromptIfPresent(page)
    await clickThroughPinPrompt(page, page.getByTestId('tab_fund_button'))
    await passAgeGateIfOffered(page)

    // The one-time welcome sheet opens over both terminal states. It wouldn't
    // fail the assertion below (toBeVisible ignores a covering modal), but it
    // stays mounted and intercepts every later test's clicks.
    const introStart = page.getByTestId('onramp-intro-start-button')
    const introOffered = await introStart
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false)
    if (introOffered) {
        await clickThroughPinPrompt(page, introStart)
    }

    const historyTab = page.getByText('History', { exact: true }).first()
    const testnetPlaceholder = page.getByText('Not available on TestNet', {
        exact: true,
    })
    await expect(historyTab.or(testnetPlaceholder)).toBeVisible({
        timeout: 30_000,
    })
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// Staking: the menu row (capability-gated, now on) pushes the Staking route
// (newly registered in WebMainRoutes) and the screen settles into a terminal
// state: the projects list (networked), the error container (networkless CI),
// or the empty view. All three are post-skeleton states.
test('staking opens from the menu and reaches a terminal state', async () => {
    await dismissPinPromptIfPresent(page)
    await clickThroughPinPrompt(page, page.getByTestId('tab_menu_button'))
    await expect(page.getByTestId('menu_screen')).toBeVisible({
        timeout: 20_000,
    })
    await clickThroughPinPrompt(page, page.getByTestId('menu_staking_button'))
    await passAgeGateIfOffered(page)

    await expect(page.getByTestId('staking-screen')).toBeVisible({
        timeout: 20_000,
    })
    const list = page.getByTestId('staking-projects-list')
    const error = page.getByTestId('staking-error-container')
    const empty = page.getByTestId('staking-empty-view')
    await expect(list.or(error).or(empty)).toBeVisible({ timeout: 30_000 })
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// Developer Settings: the row renders in the support section (capability now
// on; testID scheme settings_item_${title...} — 'Developer Settings' →
// settings_item_developer_settings) and navigating into it boots the
// DeveloperSettings stack without an uncaught error.
test('developer settings row renders and navigates', async () => {
    await dismissPinPromptIfPresent(page)
    // WebMainRoutes.tsx registers 'Staking' as a ROOT-stack sibling of
    // 'TabBar' (fullScreenLayout, its own NavigationHeader), not nested
    // inside the tab bar's stack — so the staking test leaves the whole
    // TabBar navigator (and its tab_menu_button) either unmounted or merely
    // hidden behind Staking (React Navigation doesn't guarantee which for a
    // root-stack sibling); the code below handles both.
    // NavigationHeader's back arrow (NavigationHeader.tsx:65-66,
    // testID='navigation_back_button', wired to navigation.goBack()) is the
    // real way back, mirroring what a user would tap.
    const menuTab = page.getByTestId('tab_menu_button')
    if (!(await menuTab.isVisible().catch(() => false))) {
        await clickThroughPinPrompt(
            page,
            page.getByTestId('navigation_back_button'),
        )
        await menuTab.waitFor({ state: 'visible', timeout: 10_000 })
    }
    await clickThroughPinPrompt(page, menuTab)
    await expect(page.getByTestId('menu_screen')).toBeVisible({
        timeout: 20_000,
    })
    await clickThroughPinPrompt(page, page.getByTestId('menu_settings_button'))
    await expect(page.getByTestId('settings_screen')).toBeVisible({
        timeout: 20_000,
    })

    const developerRow = page.getByTestId('settings_item_developer_settings')
    await developerRow.scrollIntoViewIfNeeded()
    await expect(developerRow).toBeVisible()
    await clickThroughPinPrompt(page, developerRow)

    await expect(
        page.getByText('Developer Settings', { exact: true }).first(),
    ).toBeVisible({ timeout: 20_000 })
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})
