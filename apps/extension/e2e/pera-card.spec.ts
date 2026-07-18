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

// M10 milestone smoke: the FIRST bundle containing the PeraCardStackNavigator
// screen graph on web (routeCapabilities.peraCard flipped on in Task 3,
// route registered in WebMainRoutes in Task 2). useIsPeraCardEnabled() reads
// remote-config `enable_pera_card`, whose fallback (isDebug || isStaging) is
// unreliable in this headless/networkless bundle — the remote-config
// OVERRIDE is seeded directly into chrome.storage.local before the page
// ever loads so useRemoteConfig().getBooleanValue() picks it up on first
// render (packages/remote-config/src/hooks/useRemoteConfig.ts checks
// configOverrides before falling through to the service). Reuses the
// gift-cards.spec.ts / feature-tabs.spec.ts fixture shape: fresh profile,
// serial, onboard once in beforeAll. Card flow is NOT age-gated (unlike
// Discover/Swap/Onramp/Staking in tab-screens.web.tsx), so no age-gate
// helper is needed here.
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
const PASSWORD = 'e2e-pera-card-password-1'

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

// Opens the account switcher and taps the Pera Card activate row, landing on
// PeraCardIntro (AccountSelection.tsx's openAccountMenu -> 'pera-card-activate'
// -> navigation.navigate('PeraCard', { screen: 'PeraCardIntro' })).
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

// 'PeraCard' is a top-level RootStack.Screen sibling of 'TabBar'
// (WebMainRoutes.tsx), so it fully replaces the Home tab (and its
// account_selection_button entry point) while focused. NavigationHeader
// renders a 'navigation_back_button' whenever navigation.canGoBack() is true
// (NavigationHeader.tsx) — which chains up through parent navigators, so it
// works both to pop within the nested PeraCardStackNavigator and, from its
// initial route, to pop the RootStack back to TabBar. Two clicks return from
// any card screen at most one level into the stack (CardSignIn) to Home.
// Native-stack keeps popped-from screens mounted underneath during the
// transition, so multiple 'navigation_back_button' nodes can coexist in the
// DOM at once — scope to the visible one (Playwright's :visible extension)
// instead of the plain testID locator to avoid a strict-mode collision.
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

    // Force enable_pera_card on before anything renders. useIsPeraCardEnabled()
    // (apps/mobile/src/hooks/useIsPeraCardEnabled.ts) falls back to
    // isDebug || isStaging when remote config hasn't resolved — unreliable in
    // a headless/networkless bundle. useRemoteConfig().getBooleanValue()
    // (packages/remote-config/src/hooks/useRemoteConfig.ts) checks
    // configOverrides BEFORE calling through to the service, so seeding the
    // override here guarantees the flag reads true on first render. Envelope
    // shape verified against packages/remote-config/src/store/store.ts:
    // STORE_NAME = 'remote-config-store', persist version = 1, partialize ->
    // { configOverrides }. Key literal verified against
    // extensions/platform-chrome/src/services/key-value-storage.ts:
    // KV_PREFIX = 'kv:' + store name, value JSON.stringify'd — same shape
    // onboarding.spec.ts asserts for 'kv:settings-store'.
    await serviceWorker.evaluate(async () => {
        await chrome.storage.local.set({
            'kv:remote-config-store': JSON.stringify({
                state: { configOverrides: { enable_pera_card: true } },
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
})

test.afterAll(async () => {
    await context.close()
})

// Activation entry -> intro: AccountScreen.tsx renders AccountSelection with
// showPeraCardActivation, whose account_selection_button opens the account
// switcher sheet (AccountMenuContent -> AccountMenu -> useAccountMenu). With
// a single, non-activated fresh account and the remote-config override on,
// useAccountMenu inserts a { kind: 'pera-card', activated: false } row,
// rendered by PeraCardAccountItem as PeraCardActivateRow
// (pera_card_activate_button) — its visibility alone proves the override
// took effect and the entry point is wired. Tapping it resolves the sheet
// with 'pera-card-activate', which navigates to PeraCard/PeraCardIntro —
// asserting the intro screen's create-account CTA
// (pera_card_intro_create_button, PeraCardIntroScreen.tsx) proves the route
// registered AND the whole card screen graph (PeraCardStackNavigator) booted
// on web with no eval-time crash.
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

// Intro -> sign-in: PeraCardIntroScreen's "already have an account" CTA
// (pera_card_intro_login_button) calls handleAlreadyHaveAccount, which
// navigates to PeraCard/CardSignIn (usePeraCardIntroScreen.ts). Asserting
// CardSignInScreen's root (testID='card-sign-in') plus its email/password
// inputs proves the nested navigator advanced to a second screen with no
// eval crash. Networkless: the form is never submitted against Baanx.
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

// Learn-more opens a browser tab, not a dead tap: PeraCardIntroScreen's
// "Learn more" link (pera_card_intro_learn_more) calls handleLearnMore,
// which — since routeCapabilities.inAppWebView is false on web
// (capabilities.web.ts) — calls Linking.openURL(config.peraCardLearnMoreUrl)
// instead of pushing the in-app webview sheet. react-native-web's Linking
// (node_modules/react-native-web/dist/exports/Linking/index.js) implements
// openURL as `window.open(url, '_blank', 'noopener')`, so a real new page
// must appear; this is the regression guard for Task 1's web-awareness on
// the card's most-reachable external link. Test 2 left the app on
// CardSignIn — pop back to Home via the nested + root stack back buttons,
// then re-enter through the same account-switcher entry point test 1 used.
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

// No-pageerror sweep: the whole Pera Card graph (activation entry, intro,
// sign-in, learn-more) must never have thrown an uncaught error across this
// entire serial run — the definitive signal that the newly-enabled screen
// graph didn't eval-crash on boot or navigation.
test('no uncaught errors across the pera card flow', () => {
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})
