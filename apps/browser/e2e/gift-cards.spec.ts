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

// M8 milestone smoke: the Bidali gift-card sheet (capability on), the FIRST
// bundle containing its independent NavigationContainer graph (intro ->
// account-selection -> webview, inside the web bottom-sheet Modal). Reuses
// the feature-tabs.spec.ts / discover.spec.ts fixture shape: fresh profile,
// serial, onboard once in beforeAll. Network access is not assumed — the
// Bidali site may not load; the iframe element (with key=/balances/bridge
// token stamped on its src) must exist regardless.
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
const PASSWORD = 'e2e-gift-cards-password-1'

// Module-eval crashes in the extension bundle otherwise surface as bare
// selector timeouts with no indication of the real cause (see onboarding.spec.ts).
const trackPageErrors = (targetPage: Page): Error[] => {
    const errors: Error[] = []
    targetPage.on('pageerror', error => errors.push(error))
    return errors
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
    // calling the service — the enable_gift_cards default is false everywhere
    // (Bidali availability switch), so the menu row only renders with the
    // override in place. Mirrors pera-card.spec.ts.
    await serviceWorker.evaluate(async () => {
        await chrome.storage.local.set({
            'kv:remote-config-store': JSON.stringify({
                state: { configOverrides: { enable_gift_cards: true } },
                version: 1,
            }),
        })
    })

    // Onboard exactly as onboarding.spec.ts / wallet-smoke.spec.ts.
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

// The 'Buy Gift Card' row has no testID of its own, unlike its menu siblings,
// so it's selected by rendered text. It is NOT age-gated, unlike
// Discover/Swap/Onramp/Staking. Reaching BidaliIntroScreen proves the whole
// gift-card graph mounted with no eval-time crash.
test('menu row opens the gift-card sheet on the intro screen', async () => {
    await dismissPinPromptIfPresent(page)
    await clickThroughPinPrompt(page, page.getByTestId('tab_menu_button'))
    await expect(page.getByTestId('menu_screen')).toBeVisible({
        timeout: 20_000,
    })

    // Web Menu entry point: the link icon opening the PasteLinkContent sheet
    // replaces the camera icon's QR scanner, since the extension has no camera
    // to scan with. routeCapabilities.deepLinkPaste is on and
    // routeCapabilities.qrScanner is off on web (capabilities.web.ts).
    await expect(page.getByTestId('menu_paste_link_button')).toBeVisible()
    await expect(page.getByTestId('menu_button')).not.toBeAttached()

    await clickThroughPinPrompt(
        page,
        page.getByText('Buy Gift Card', { exact: true }),
    )

    await expect(page.getByTestId('bidali_intro_buy_button')).toBeVisible({
        timeout: 20_000,
    })
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// The account picker passes no rowTestIDPrefix, so rows fall back to
// `account-row-${address}` — one row here, unfiltered by balance.
//
// Assert against the CONFIGURED base host (commerce.bidali.com/dapp): the 302
// to the giftcards.* twin only happens once the network resolves it.
test('account selection advances to the webview iframe with the bridge params', async () => {
    // Resumes the sheet left open on BidaliIntro by the previous test —
    // BidaliIntroScreen.handleBuyGiftCards navigates to
    // 'BidaliAccountSelection' on press.
    await clickThroughPinPrompt(
        page,
        page.getByTestId('bidali_intro_buy_button'),
    )
    await clickThroughPinPrompt(page, page.getByTestId(/^account-row-/).first())

    const iframe = page.locator('iframe[src*="peraBridgeToken="]')
    await expect(iframe).toBeAttached({ timeout: 20_000 })
    const src = await iframe.getAttribute('src')
    expect(src).toContain('commerce.bidali.com/dapp')
    expect(src).toMatch(/[?&]key=/)
    expect(src).toMatch(/[?&]peraBidaliBalances=/)
    // generateBridgeToken() produces 32 lowercase-hex chars
    // (handlers-shared.ts) — require a non-empty token, not just the bare
    // param name.
    expect(src).toMatch(/[?&]peraBridgeToken=[0-9a-f]+/)
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// Networked best-effort: when the Bidali site actually loads, the MAIN
// world content script (bidali-main.ts) must have installed
// window.bidaliProvider inside the iframe with name: 'perawallet'. Skipped
// (not failed) when the frame never gets a document — networkless CI stays
// green; the manual checklist owns the full round-trip. Mirrors
// discover.spec.ts's skip pattern for window.peraMobileInterface.
test('gift-card iframe gets the bidali provider when the site loads', async () => {
    const frame = page
        .frames()
        .find(candidate => candidate.url().includes('peraBridgeToken='))
    test.skip(frame == null, 'bidali frame did not load (networkless run)')

    const providerName = await frame!
        .waitForFunction(
            () =>
                (
                    window as unknown as {
                        bidaliProvider?: { name?: string }
                    }
                ).bidaliProvider?.name,
            undefined,
            { timeout: 15_000 },
        )
        .then(handle => handle.jsonValue())
        .catch(() => undefined)
    test.skip(providerName == null, 'bidali site did not finish booting')
    expect(providerName).toBe('perawallet')
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// No-pageerror sweep: the whole gift-card graph (intro, account selection,
// webview mount) must never have thrown an uncaught error across this
// entire serial run — the definitive signal that the newly-enabled screen
// graph didn't eval-crash on boot or navigation.
test('no uncaught errors across the gift-card flow', () => {
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})
