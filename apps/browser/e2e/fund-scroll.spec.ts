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

// Regression: the Fund form lives inside the PagerView web shim,
// and when a page's height chain isn't pushed down from the pager frame the
// form's vertical ScrollView grows to content height instead of scrolling —
// the frame's overflow then clips the Proceed button with no way to reach it.
//
// The ramp endpoints are fulfilled from fixtures (mirroring
// apps/mobile/src/__integration__/onramp.spec.tsx's Meld pair) so the form
// renders deterministically without a backend key.
import {
    expect,
    test,
    chromium,
    type BrowserContext,
    type Page,
    type Route,
} from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clickThroughPinPrompt, dismissPinPromptIfPresent } from './pin-prompt'
import { skipPasskeyUnlockStep } from './passkey-unlock-step'

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)

let context: BrowserContext
let extensionId: string
let page: Page
let pageErrors: Error[]
const PASSWORD = 'e2e-fund-scroll-password-1'

const trackPageErrors = (targetPage: Page): Error[] => {
    const errors: Error[] = []
    targetPage.on('pageerror', error => errors.push(error))
    return errors
}

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

const ALGO_ASSET = {
    asset_id: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k/asa:0',
    name: 'Algorand',
    unit_name: 'ALGO',
    fraction_decimals: 6,
}

const USD_ASSET = {
    asset_id: 'swift:0/iso4217:USD',
    name: 'US Dollar',
    unit_name: 'USD',
    fraction_decimals: 2,
}

// Meld (fiat) route: the form seeds a source amount and renders the full
// quote-dependent row set, matching what a real user sees on mainnet.
const DESTINATIONS = {
    next: null,
    results: [{ kind: 'token', asset: ALGO_ASSET }],
}

const SOURCES = {
    next: null,
    results: [{ kind: 'fiat', asset: USD_ASSET }],
}

const MELD_QUOTES = {
    results: [
        {
            quote_id: 'quote-meld-600',
            aggregator: 'meld',
            provider: 'MERCURYO',
            source_asset: USD_ASSET,
            destination_asset: ALGO_ASSET,
            source_amount: '60000',
            destination_amount_expected: '950500000',
            funding_method: 'provider_checkout',
            extras: { payment_method: 'CREDIT_DEBIT_CARD' },
        },
    ],
}

test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        args: [
            `--disable-extensions-except=${dist}`,
            `--load-extension=${dist}`,
        ],
    })

    const json = (route: Route, body: unknown) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(body),
        })

    // Only the region still lives on /v1/ramp; the rest runs on the swap router.
    await context.route('**/v1/ramp/**', route => {
        if (route.request().url().includes('/v1/ramp/regions')) {
            return json(route, {
                country_code: 'US',
                country_name: 'United States',
            })
        }
        return route.continue()
    })

    await context.route('**/api/v4/swap/**', route => {
        const url = new URL(route.request().url())
        if (url.pathname.endsWith('/pairs/')) {
            return json(
                route,
                url.searchParams.has('destination') ? SOURCES : DESTINATIONS,
            )
        }
        if (url.pathname.endsWith('/quotes/')) return json(route, MELD_QUOTES)
        if (url.pathname.endsWith('/history/')) {
            return json(route, { next: null, results: [] })
        }
        return route.continue()
    })

    let [serviceWorker] = context.serviceWorkers()
    if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker')
    }
    extensionId = new URL(serviceWorker.url()).host

    // Nudges off (as in wallet-smoke.spec.ts) plus the one-time onramp
    // welcome sheet marked seen, so the Fund tab opens straight into the form.
    await serviceWorker.evaluate(async () => {
        await chrome.storage.local.set({
            'kv:settings-store': JSON.stringify({
                state: {
                    preferences: {
                        security_pin_setup_prompt: true,
                        'transaction-info-agreed': true,
                        'onramp-introduction-seen': true,
                    },
                },
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
    await skipPasskeyUnlockStep(page)

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
    await context?.close()
})

test('fund form scrolls to the Proceed button when it overflows the viewport', async () => {
    // Shorter than the form so the Proceed button starts below the fold —
    // same constraint the fixed 600px popup imposes on the real backend's
    // taller form content.
    await page.setViewportSize({ width: 360, height: 420 })

    await dismissPinPromptIfPresent(page)
    await clickThroughPinPrompt(page, page.getByTestId('tab_fund_button'))
    await passAgeGateIfOffered(page)

    const buyButton = page.getByTestId('onramp-buy-button')
    await buyButton.waitFor({ state: 'attached', timeout: 30_000 })

    // Guard the test's own premise: if the fixture form ever fits the
    // viewport, scrolling proves nothing — fail here instead of passing
    // vacuously.
    await expect(buyButton).not.toBeInViewport()

    await page.mouse.move(180, 250)
    await page.mouse.wheel(0, 800)

    await expect(buyButton).toBeInViewport({ timeout: 5000 })
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})
