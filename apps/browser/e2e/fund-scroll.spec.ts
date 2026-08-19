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

// PERA-4948 regression: the Fund form lives inside the PagerView web shim,
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
} from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { clickThroughPinPrompt, dismissPinPromptIfPresent } from './pin-prompt'

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

const ALGORAND_NETWORK = { id: 'ALGORAND', name: 'Algorand', logo: null }

// Meld (fiat) pair: the form seeds a source amount and renders the full
// quote-dependent row set, matching what a real user sees on mainnet.
const MELD_PAIR = {
    id: 'pair-usd-algo',
    source_token: {
        id: 'USD',
        symbol: 'USD',
        name: 'US Dollar',
        fraction_decimals: 2,
        logo: null,
        network: { id: 'FIAT', name: 'Fiat', logo: null },
        price_in_usd: '1',
        extra: {},
    },
    destination_token: {
        id: 'ALGO',
        symbol: 'ALGO',
        name: 'Algorand',
        fraction_decimals: 6,
        logo: null,
        network: ALGORAND_NETWORK,
        price_in_usd: '1',
        extra: {},
    },
    provider: {
        id: 'meld',
        payment_types: ['CARD'],
        limits: { min_source_amount: '600', max_source_amount: '5000' },
    },
}

const MELD_QUOTE = {
    quote_id: 'quote-meld-600',
    provider_response: {
        sourceAmount: 600,
        destinationAmount: 950.5,
        sourceCurrencyCode: 'USD',
        destinationCurrencyCode: 'ALGO',
        totalFee: 6,
        networkFee: null,
        transactionFee: 6,
        exchangeRate: 0.63,
        paymentMethodType: 'CREDIT_DEBIT_CARD',
        serviceProvider: 'MERCURYO',
        institutionName: null,
        lowKyc: false,
    },
    payment_method: {
        id: 'CREDIT_DEBIT_CARD',
        logo: null,
        name: 'Credit card',
    },
}

test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        args: [
            `--disable-extensions-except=${dist}`,
            `--load-extension=${dist}`,
        ],
    })

    await context.route('**/v1/ramp/**', route => {
        const url = route.request().url()
        const json = (body: unknown) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(body),
            })
        if (url.includes('/v1/ramp/pairs/')) return json([MELD_PAIR])
        if (url.includes('/v1/ramp/regions'))
            return json({ country_code: 'US', country_name: 'United States' })
        if (url.includes('/v1/ramp/quotes/')) return json([MELD_QUOTE])
        if (url.includes('/v1/ramp/history/'))
            return json({ count: 0, next: null, previous: null, results: [] })
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
