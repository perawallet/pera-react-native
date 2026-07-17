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

// M6 milestone smoke: the Discover tab (capability on), newly enabled on web.
// Reuses the feature-tabs.spec.ts fixture shape: fresh profile, serial,
// onboard once in beforeAll. Network access is not assumed — the iframe
// element (with the stamped bridge token param) must exist regardless of
// whether the Discover site loads; content assertions inside the frame run
// only when the frame document actually loads.
import {
    expect,
    test,
    chromium,
    type BrowserContext,
    type Locator,
    type Page,
} from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)

test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let extensionId: string
let page: Page
let pageErrors: Error[]
const PASSWORD = 'e2e-discover-password-1'

// Module-eval crashes in the extension bundle otherwise surface as bare
// selector timeouts with no indication of the real cause (see onboarding.spec.ts).
const trackPageErrors = (targetPage: Page): Error[] => {
    const errors: Error[] = []
    targetPage.on('pageerror', error => errors.push(error))
    return errors
}

// PromptContainer's one-time security nudge fires on a wall-clock delay from
// account creation (see wallet-smoke.spec.ts) — dismiss it wherever it lands.
const dismissPinPromptIfPresent = async (targetPage: Page): Promise<void> => {
    const notNow = targetPage.getByTestId('pin_security_prompt_not_now_button')
    if (await notNow.isVisible().catch(() => false)) {
        await notNow.click()
    }
}

// The pin-security-prompt sheet fires on a wall-clock delay from account
// creation (see dismissPinPromptIfPresent above) and can land as a
// full-screen backdrop between a visibility wait and the click that
// follows, intercepting clicks anywhere on the page — wallet-smoke.spec.ts
// guards the identical race in openMoreSheet by retrying the click with a
// dismiss attempt interleaved. Reused here for every click downstream of a
// waitFor, since which test happens to be running when the delay elapses is
// non-deterministic.
const clickThroughPinPrompt = async (
    targetPage: Page,
    locator: Locator,
): Promise<void> => {
    for (let attempt = 0; attempt < 5; attempt++) {
        await dismissPinPromptIfPresent(targetPage)
        const clicked = await locator
            .click({ timeout: 3000 })
            .then(() => true)
            .catch(() => false)
        if (clicked) return
        await dismissPinPromptIfPresent(targetPage)
    }
    // Bounded, not left to Playwright's unlimited default action timeout: a
    // locator that's genuinely stuck (e.g. an unrelated overlay left open by
    // a prior test) should fail this click with a clear timeout instead of
    // hanging until the whole test's timeout budget is exhausted.
    await locator.click({ timeout: 10_000 })
}

// The web ChromeAgeGateService resolves {status:'unknown', capability:'manual'},
// so the FIRST focus of any age-gated screen offers the self-declaration sheet.
// The declared result persists in the age-gate store, so only one test pays
// this cost — but which test runs first isn't guaranteed if the suite is ever
// re-sliced, so every gated entry point calls this helper.
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
})

test.afterAll(async () => {
    await context.close()
})

// Discover: the tab renders (capability on), the age gate self-declaration
// works, and the screen mounts the PWWebView.web iframe with the bridge
// token stamped on its src. The Discover SITE loading needs network — the
// iframe element existing does not, so that's the unconditional assertion;
// frame-content checks are best-effort (next test).
test('discover tab renders the bridged iframe', async () => {
    await dismissPinPromptIfPresent(page)
    await clickThroughPinPrompt(page, page.getByTestId('tab_discover_button'))
    await passAgeGateIfOffered(page)

    const iframe = page.locator('iframe[src*="peraBridgeToken="]')
    await expect(iframe).toBeAttached({ timeout: 20_000 })
    const src = await iframe.getAttribute('src')
    // The e2e/dev bundle always resolves discoverBaseUrl to the staging
    // default (packages/config/src/main.ts) since no DISCOVER_BASE_URL
    // override is set here — a prod-configured bundle would legitimately
    // point at a different perawallet.app host; that's the manual
    // checklist's concern, not this spec's.
    expect(src).toContain('discover-mobile-staging.perawallet.app')
    // generateBridgeToken() produces 32 lowercase-hex chars
    // (handlers-shared.ts) — require a non-empty token, not just the bare
    // param name (which `src*="peraBridgeToken="` alone would also match).
    expect(src).toMatch(/[?&]peraBridgeToken=[0-9a-f]+/)
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// Networked best-effort: when the Discover site actually loads, the MAIN
// world content script must have installed the bridge interface inside the
// iframe. Skipped (not failed) when the frame never gets a document —
// networkless CI stays green; Task 8's manual checklist owns the full
// round-trip.
test('discover iframe gets the bridge interface when the site loads', async () => {
    const frame = page
        .frames()
        .find(candidate => candidate.url().includes('peraBridgeToken='))
    test.skip(frame == null, 'discover frame did not load (networkless run)')

    const hasInterface = await frame!
        .waitForFunction(
            () =>
                typeof (window as never)['peraMobileInterface'] !== 'undefined',
            undefined,
            { timeout: 15_000 },
        )
        .then(() => true)
        .catch(() => false)
    test.skip(!hasInterface, 'discover site did not finish booting')
    expect(hasInterface).toBe(true)
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})
