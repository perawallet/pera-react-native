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

// Funded-account-free happy path through the real shell: onboard, portfolio
// home, menu -> settings, lock. Same fixture shape as onboarding.spec.ts.
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
const PASSWORD = 'e2e-wallet-smoke-password-1'

// Without this, module-eval crashes in the bundle surface as bare selector
// timeouts with no sign of the real cause.
const trackPageErrors = (targetPage: Page): Error[] => {
    const errors: Error[] = []
    targetPage.on('pageerror', error => errors.push(error))
    return errors
}

// Escape doesn't work — RNW's Modal never wires it to onRequestClose. The
// sheet is bottom-anchored and capped at SHEET_MAX_RATIO, so a point near the
// top of the viewport is always backdrop.
//
// A single fire-and-forget click isn't enough: it can land mid enter-animation
// or on a nudge that raced over the backdrop, leaving the sheet open. Specs
// share one page in serial mode, so an unclosed sheet doesn't fail the test
// that opened it — it silently covers the tab bar and times out the NEXT spec
// that touches this page (that's how a leaked Send sheet surfaced three tests
// later as "settings opens from the menu tab"). Click, confirm the sheet
// unmounted, retry, and assert closure here so any genuine failure lands on the
// test that owns the sheet.
const dismissSheet = async (targetPage: Page): Promise<void> => {
    const backdrop = targetPage.getByTestId('pw-bottom-sheet-backdrop')
    for (let attempt = 0; attempt < 5; attempt++) {
        if (!(await backdrop.isVisible().catch(() => false))) return
        await dismissPinPromptIfPresent(targetPage)
        await backdrop.click({ position: { x: 10, y: 10 } }).catch(() => {})
        const closed = await backdrop
            .waitFor({ state: 'hidden', timeout: 2000 })
            .then(() => true)
            .catch(() => false)
        if (closed) return
    }
    await expect(backdrop).toBeHidden({ timeout: 5000 })
}

// RoundButton renders its label as a SIBLING of the touchable, not a child, so
// click the touchable directly. A pixel offset above the label doesn't work:
// the web page-stack lays the card out at a different vertical offset.
const clickRoundButtonByLabel = async (
    targetPage: Page,
    label: string,
): Promise<void> => {
    const text = targetPage.getByText(label, { exact: true })
    await expect(text).toBeVisible({ timeout: 20_000 })
    await text.locator('xpath=../*[1]').first().click()
}

const openMoreSheet = async (targetPage: Page): Promise<void> => {
    const copyAddress = targetPage.getByText('Copy Address', { exact: true })
    for (let attempt = 0; attempt < 4; attempt++) {
        await dismissPinPromptIfPresent(targetPage)
        await targetPage.getByTestId('more_button').click()
        const opened = await copyAddress
            .waitFor({ state: 'visible', timeout: 3000 })
            .then(() => true)
            .catch(() => false)
        if (opened) return
        await dismissPinPromptIfPresent(targetPage)
    }
    await expect(copyAddress).toBeVisible({ timeout: 5000 })
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

    // Seed both first-use nudges (PIN security, "Transacting Tips") as already
    // dismissed so they never mount. They fire on wall-clock delays, so the
    // reactive dismissals elsewhere only guard the click they wrap — a delay
    // elapsing later leaves an overlay blocking the NEXT test's first click.
    await serviceWorker.evaluate(async () => {
        await chrome.storage.local.set({
            'kv:settings-store': JSON.stringify({
                state: {
                    preferences: {
                        security_pin_setup_prompt: true,
                        'transaction-info-agreed': true,
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
    await context.close()
})

test('portfolio renders the empty-state account with the ALGO row', async () => {
    await expect(page.getByTestId('account_screen')).toBeVisible({
        timeout: 30_000,
    })

    // The ALGO row only exists after the account-syncer's network round-trip,
    // so a networkless run lands on the empty state instead. Both are terminal,
    // non-skeleton states — accepting either is what proves we're past the
    // loading skeleton rather than racing it (account_screen is present even
    // mid-skeleton, so it proves nothing).
    const algoRow = page.getByText('ALGO', { exact: true }).first()
    const emptyState = page.getByText('No Assets', { exact: true })
    await expect(algoRow.or(emptyState)).toBeVisible({ timeout: 30_000 })

    if (await algoRow.isVisible()) {
        await expect(algoRow).toBeVisible()
    } else {
        await expect(emptyState).toBeVisible()
    }
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// On web, react-native-svg mounts real DOM, so every icon's clipPath ids share
// one document-wide namespace and `url(#id)` resolves to whichever icon came
// first — clipping icons to unrelated shapes. Asserting no id is literally "a"
// wouldn't prove the prefix scheme is collision-free; asserting global id
// uniqueness does. Run on portfolio home, where the colliding icons co-render.
test('icon SVGs never collide on id — no duplicate id values on the page', async () => {
    await expect(page.getByTestId('account_screen')).toBeVisible({
        timeout: 20_000,
    })
    const duplicateIds = await page.evaluate(() => {
        const seen = new Map<string, number>()
        for (const el of Array.from(document.querySelectorAll('[id]'))) {
            const id = el.id
            seen.set(id, (seen.get(id) ?? 0) + 1)
        }
        return [...seen.entries()].filter(([, count]) => count > 1)
    })
    expect(duplicateIds, 'duplicate id values found in the document').toEqual(
        [],
    )
})

// PWBottomSheet.web.tsx renders a plain Modal with no gorhom provider, so a
// PWSheetLayout reaching for `BottomSheetScrollView` throws and unmounts the
// whole app as a blank page. Assert real content, not just the absence of an
// error.
test('the More sheet (PWSheetLayout) renders real content, not blank', async () => {
    await expect(page.getByTestId('account_screen')).toBeVisible({
        timeout: 20_000,
    })
    await openMoreSheet(page)
    await expect(page.getByText('Show Address', { exact: true })).toBeVisible()
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
    await dismissSheet(page)
})

// Guards the `NotifierWrapper` host staying mounted in AppShell.web — without
// it `Notifier.showNotification` silently no-ops.
test('copy address shows a toast that auto-dismisses', async () => {
    await expect(page.getByTestId('account_screen')).toBeVisible({
        timeout: 20_000,
    })
    await openMoreSheet(page)
    await page.getByText('Copy Address', { exact: true }).click()

    // The toast animates via `translateY` and never unmounts, so toBeVisible()
    // stays true even off-screen. Poll the actual Y position instead.
    const toast = page.getByText('Copied to clipboard', { exact: true })
    await expect(toast).toBeVisible({ timeout: 20_000 })
    await expect
        .poll(async () => (await toast.boundingBox())?.y ?? -1, {
            timeout: 5000,
        })
        .toBeGreaterThanOrEqual(0)

    await expect
        .poll(async () => (await toast.boundingBox())?.y ?? 0, {
            timeout: 10_000,
        })
        .toBeLessThan(0)

    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// A nested `@react-navigation/stack` navigator collapses to height 0 inside
// PWBottomSheet.web's Modal — its web output needs a flex chain that resolves
// a real pixel height. Guards the native-stack swap in ReceiveFundsRoutes.web.
test('the Receive sheet (nested navigator) renders real content, not blank', async () => {
    await dismissPinPromptIfPresent(page)
    await page.getByTestId('tab_menu_button').click()
    await expect(page.getByTestId('menu_screen')).toBeVisible({
        timeout: 20_000,
    })
    await page
        .getByTestId('menu_screen')
        .getByText('Receive', { exact: true })
        .click()
    await expect(page.getByText('Select Account', { exact: true })).toBeVisible(
        {
            timeout: 20_000,
        },
    )
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
    await dismissSheet(page)
})

// An unbroken 58-char address needs a definite-width ancestor to wrap: CSS
// flexbox sizes an unconstrained centered child to its natural width, where
// Yoga resolves a real one. Guards `alignSelf: 'stretch'` on QRViewScreen's
// address button.
test('the receive address wraps instead of overflowing the sheet', async () => {
    // Needs its own 360x600 page — the address fits fine in this suite's
    // 1280px expanded viewport even unwrapped. chrome.storage is shared across
    // pages in the context, so popup.html opens straight to account_screen.
    const popupPage = await context.newPage()
    const popupPageErrors = trackPageErrors(popupPage)
    await popupPage.setViewportSize({ width: 360, height: 600 })
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`)
    await expect(popupPage.getByTestId('account_screen')).toBeVisible({
        timeout: 20_000,
    })

    await dismissPinPromptIfPresent(popupPage)
    await popupPage.getByTestId('tab_menu_button').click()
    await expect(popupPage.getByTestId('menu_screen')).toBeVisible({
        timeout: 20_000,
    })
    await popupPage
        .getByTestId('menu_screen')
        .getByText('Receive', { exact: true })
        .click()
    await expect(
        popupPage.getByText('Select Account', { exact: true }),
    ).toBeVisible({ timeout: 20_000 })
    // Single-account fixture, so exactly one row.
    await popupPage
        .locator('[data-testid^="receive_account_row-"]')
        .first()
        .click()

    const addressBox = await popupPage.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*'))
        for (const el of all) {
            const text = el.textContent ?? ''
            const trimmed = text.trim()
            // Base32 Algorand address, 58 chars, no separators.
            if (/^[A-Z2-7]{50,60}$/.test(trimmed) && el.children.length === 0) {
                return {
                    scrollWidth: (el as HTMLElement).scrollWidth,
                    clientWidth: (el as HTMLElement).clientWidth,
                    clientHeight: (el as HTMLElement).clientHeight,
                }
            }
        }
        return null
    })

    expect(addressBox, 'address element not found').not.toBeNull()
    // No horizontal overflow (it isn't spilling past its own box)...
    expect(addressBox?.scrollWidth).toBeLessThanOrEqual(
        addressBox?.clientWidth ?? 0,
    )
    // ...and it actually wrapped to more than one line, rather than being
    // squeezed onto one line by an unrelated font/width coincidence.
    expect(addressBox?.clientHeight).toBeGreaterThan(24)

    expect(popupPageErrors, 'page threw an uncaught error').toEqual([])
    await popupPage.close()
})

// Same nested-navigator collapse as the Receive sheet above; guards
// SendFundsRoutes.web. Driven via an asset's own Send action because the home
// tab's Send button is gated behind a funded account, unreachable here.
test('the Send sheet (nested navigator) renders real content, not blank', async () => {
    await dismissPinPromptIfPresent(page)
    const home = page.getByText('Home', { exact: true })
    if (await home.isVisible().catch(() => false)) {
        await home.click()
    }
    await expect(page.getByTestId('account_screen')).toBeVisible({
        timeout: 20_000,
    })

    const algoRow = page.getByText('Algo', { exact: true }).first()
    const hasAlgoRow = await algoRow.isVisible().catch(() => false)
    test.skip(
        !hasAlgoRow,
        'no ALGO holding row in this network-less run — nothing to open asset details for',
    )

    await dismissPinPromptIfPresent(page)
    await algoRow.click()
    await dismissPinPromptIfPresent(page)

    const sendButton = page.getByText('Send', { exact: true })
    await expect(sendButton).toBeVisible({ timeout: 20_000 })
    await clickRoundButtonByLabel(page, 'Send')

    // Dismiss the "Transacting Tips" interstitial so the check below isn't
    // just asserting on the interstitial's own content.
    const iUnderstand = page.getByText('I Understand', { exact: true })
    if (await iUnderstand.isVisible({ timeout: 3000 }).catch(() => false)) {
        await iUnderstand.click()
    }

    await expect(page.getByText('Send Algo', { exact: true })).toBeVisible({
        timeout: 20_000,
    })
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
    // Clear the PIN prompt first — it may have raced in and now covers the
    // backdrop the click below targets.
    await dismissPinPromptIfPresent(page)
    await dismissSheet(page)
})

// Add-account must navigate in-place on every surface, not hand off to a new
// expanded tab. Driven at the real 360x600 popup size.
test('add account navigates in-place instead of opening a new tab', async () => {
    const popupPage = await context.newPage()
    const popupPageErrors = trackPageErrors(popupPage)
    await popupPage.setViewportSize({ width: 360, height: 600 })
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`)
    await expect(popupPage.getByTestId('account_screen')).toBeVisible({
        timeout: 20_000,
    })
    await dismissPinPromptIfPresent(popupPage)

    const tabsBefore = context.pages().length

    await popupPage.getByTestId('account_selection_button').click()
    await popupPage
        .getByTestId('account_menu_add_account_button')
        .click({ timeout: 20_000 })

    await expect(
        popupPage.getByTestId('add_account_import_button'),
    ).toBeVisible({ timeout: 20_000 })
    await expect(popupPage.getByTestId('expanded-redirect')).toHaveCount(0)

    // No new tab was spawned by the navigation.
    expect(context.pages().length).toBe(tabsBefore)

    expect(popupPageErrors, 'page threw an uncaught error').toEqual([])
    await popupPage.close()
})

// Search and Messages must stay registered in WebMainRoutes — unregistered,
// both header affordances silently no-op on web.
test('the ellipsis Search item navigates to the search screen in-place', async () => {
    const popupPage = await context.newPage()
    const popupPageErrors = trackPageErrors(popupPage)
    await popupPage.setViewportSize({ width: 360, height: 600 })
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`)
    await expect(popupPage.getByTestId('account_screen')).toBeVisible({
        timeout: 20_000,
    })
    await dismissPinPromptIfPresent(popupPage)

    const tabsBefore = context.pages().length

    await popupPage.getByTestId('account_screen_dropdown').click()
    await popupPage.getByText('Search', { exact: true }).click()

    await expect(popupPage.getByTestId('search_input')).toBeVisible({
        timeout: 20_000,
    })
    // In-place: no expanded-tab redirect spawned a second page.
    expect(context.pages().length).toBe(tabsBefore)
    expect(popupPageErrors, 'page threw an uncaught error').toEqual([])
    await popupPage.close()
})

// Both tab labels are asserted so this proves the tab navigator rendered real
// content, not a blank crash.
test('the notifications bell opens the inbox in-place', async () => {
    const popupPage = await context.newPage()
    const popupPageErrors = trackPageErrors(popupPage)
    await popupPage.setViewportSize({ width: 360, height: 600 })
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`)
    await expect(popupPage.getByTestId('account_screen')).toBeVisible({
        timeout: 20_000,
    })
    await dismissPinPromptIfPresent(popupPage)

    const tabsBefore = context.pages().length

    await popupPage.getByTestId('notifications_icon').click()

    await expect(
        popupPage.getByText('Inbox', { exact: true }).first(),
    ).toBeVisible({ timeout: 20_000 })
    await expect(
        popupPage.getByText('Notifications', { exact: true }).first(),
    ).toBeVisible()
    // In-place: no expanded-tab redirect spawned a second page.
    expect(context.pages().length).toBe(tabsBefore)
    expect(popupPageErrors, 'page threw an uncaught error').toEqual([])
    await popupPage.close()
})

// The home header carries a paste-a-deeplink entry instead of a QR camera:
// routeCapabilities.qrScanner is off for web and deepLinkPaste is on
// (capabilities.web.ts). The camera-in-tab hand-off is covered below. Must run
// on popup.html, which is what sets __PERA_SURFACE__='popup'.
test('the home header offers paste-a-deeplink, not a QR camera', async () => {
    const popupPage = await context.newPage()
    const popupPageErrors = trackPageErrors(popupPage)
    await popupPage.setViewportSize({ width: 360, height: 600 })
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`)
    await expect(popupPage.getByTestId('account_screen')).toBeVisible({
        timeout: 20_000,
    })
    await dismissPinPromptIfPresent(popupPage)

    await expect(
        popupPage.getByTestId('account_screen_paste_link_button'),
    ).toBeVisible()
    await expect(
        popupPage.getByTestId('account_screen_qr_scanner_button'),
    ).not.toBeAttached()

    expect(popupPageErrors, 'page threw an uncaught error').toEqual([])
    await popupPage.close()
})

// The camera-in-tab hand-off itself is still live on web — Connections
// settings mounts QRScannerView without skipDeepLinkHandler, so on the popup
// surface QRScannerView.web renders a "scan with camera" button (hands off to
// the expanded tab via openExpandedTab) plus a working paste fallback, never a
// blank sheet or an inline auto-starting camera. The 360x600 popup can't host
// getUserMedia's focus-stealing permission dialog, which is why the hand-off
// exists. Must be driven on a real popup-surface page (popup.html sets
// __PERA_SURFACE__='popup'); the shared `page` is expanded.
test('the connections scanner opens the camera-in-tab hand-off, not a blank sheet', async () => {
    const popupPage = await context.newPage()
    const popupPageErrors = trackPageErrors(popupPage)
    await popupPage.setViewportSize({ width: 360, height: 600 })
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`)
    await expect(popupPage.getByTestId('account_screen')).toBeVisible({
        timeout: 20_000,
    })
    await dismissPinPromptIfPresent(popupPage)

    await clickThroughPinPrompt(
        popupPage,
        popupPage.getByTestId('tab_menu_button'),
    )
    await expect(popupPage.getByTestId('menu_screen')).toBeVisible({
        timeout: 20_000,
    })
    await clickThroughPinPrompt(
        popupPage,
        popupPage.getByTestId('menu_settings_button'),
    )
    await expect(popupPage.getByTestId('settings_screen')).toBeVisible({
        timeout: 20_000,
    })
    await clickThroughPinPrompt(
        popupPage,
        popupPage.getByTestId('settings_item_connections'),
    )
    await expect(
        popupPage.getByTestId('connections_settings_screen'),
    ).toBeVisible({ timeout: 20_000 })

    // Two entry points, never both at once: the header icon once the list is
    // non-empty, the empty state's own button otherwise.
    const headerScan = popupPage.getByTestId('connections_settings_scan_button')
    const emptyScan = popupPage.getByTestId(
        'connections_settings_connect_button',
    )
    await expect(headerScan.or(emptyScan).first()).toBeVisible({
        timeout: 20_000,
    })
    await ((await headerScan.isVisible()) ? headerScan : emptyScan).click()

    await expect(popupPage.getByTestId('qr-scan-with-camera')).toBeVisible({
        timeout: 20_000,
    })
    await expect(popupPage.getByTestId('qr-paste-input')).toBeVisible()
    expect(popupPageErrors, 'page threw an uncaught error').toEqual([])
    await popupPage.close()
})

test('settings opens from the menu tab', async () => {
    await clickThroughPinPrompt(page, page.getByTestId('tab_menu_button'))
    await expect(page.getByTestId('menu_screen')).toBeVisible({
        timeout: 20_000,
    })
    await clickThroughPinPrompt(page, page.getByTestId('menu_settings_button'))
    await expect(page.getByTestId('settings_screen')).toBeVisible()

    // PWScreen's flex chain needs minHeight:0 on web, or the scroll body never
    // gets a bounded height and the screen doesn't scroll at all.
    const removeAll = page.getByTestId('settings_remove_all_accounts_button')
    await removeAll.scrollIntoViewIfNeeded()
    await expect(removeAll).toBeInViewport()
})

// The expanded-tab scroll check above is a false positive — nothing overflows
// a full-height tab. The fixed 600px popup is where scrolling actually breaks.
test('settings scrolls to the remove-all button in the 600px popup', async () => {
    const popupPage = await context.newPage()
    const popupPageErrors = trackPageErrors(popupPage)
    await popupPage.setViewportSize({ width: 360, height: 600 })
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`)
    await expect(popupPage.getByTestId('account_screen')).toBeVisible({
        timeout: 20_000,
    })
    await dismissPinPromptIfPresent(popupPage)

    await popupPage.getByTestId('tab_menu_button').click()
    await expect(popupPage.getByTestId('menu_screen')).toBeVisible({
        timeout: 20_000,
    })
    await popupPage.getByTestId('menu_settings_button').click()
    await expect(popupPage.getByTestId('settings_screen')).toBeVisible()

    const removeAll = popupPage.getByTestId(
        'settings_remove_all_accounts_button',
    )
    await removeAll.scrollIntoViewIfNeeded()
    await expect(removeAll).toBeInViewport()
    expect(popupPageErrors, 'page threw an uncaught error').toEqual([])
    await popupPage.close()
})

// Hits the SUPPORTED branch with no stubbing: real Chromium (headless
// included) reports `extension:prf: true` even with no platform authenticator
// attached, since it's a client-software capability flag. The test below
// covers the unsupported branch.
test('vault security settings surface change-password and passkey sections', async () => {
    // Settings testIDs are derived from the row title:
    // `settings_item_${title.toLowerCase().replace(/\s+/g, '_')}`.
    await page.getByTestId('settings_item_security').click()
    await expect(page.getByTestId('vault-security-screen')).toBeVisible({
        timeout: 20_000,
    })

    await expect(
        page.getByTestId('vault-security-change-password-section'),
    ).toBeVisible()
    await expect(
        page.getByTestId('vault-security-current-password'),
    ).toBeVisible()
    await expect(page.getByTestId('vault-security-new-password')).toBeVisible()
    await expect(
        page.getByTestId('vault-security-confirm-new-password'),
    ).toBeVisible()
    await expect(
        page.getByTestId('vault-security-change-password-submit'),
    ).toBeVisible()

    // The toggle starts disabled because no password has been entered yet.
    await expect(
        page.getByText('Passkey unlock', { exact: true }),
    ).toBeVisible()
    await expect(
        page.getByTestId('vault-security-passkey-password'),
    ).toBeVisible()
    const passkeyToggle = page.getByTestId('vault-security-passkey-toggle')
    await expect(passkeyToggle).toBeVisible()
    // PWButton marks disabled via aria-disabled, so toBeDisabled() (which
    // checks the native attribute) doesn't apply.
    await expect(passkeyToggle).toHaveAttribute('aria-disabled', 'true')

    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// Stubbing `getClientCapabilities` via addInitScript is the only way to reach
// the unsupported branch against real Chromium — it must run before the
// bundle's mount-time capability check. Own page, so the shared one is
// undisturbed.
test('vault security settings hide the passkey section when unsupported', async () => {
    const unsupportedPage = await context.newPage()
    const unsupportedPageErrors = trackPageErrors(unsupportedPage)
    await unsupportedPage.addInitScript(() => {
        class StubPublicKeyCredential {
            static getClientCapabilities(): Promise<Record<string, boolean>> {
                return Promise.resolve({ 'extension:prf': false })
            }
        }
        Object.defineProperty(window, 'PublicKeyCredential', {
            value: StubPublicKeyCredential,
            configurable: true,
            writable: true,
        })
    })
    await unsupportedPage.goto(
        `chrome-extension://${extensionId}/expanded.html`,
    )
    await expect(unsupportedPage.getByTestId('account_screen')).toBeVisible({
        timeout: 20_000,
    })
    await dismissPinPromptIfPresent(unsupportedPage)

    await unsupportedPage.getByTestId('tab_menu_button').click()
    await expect(unsupportedPage.getByTestId('menu_screen')).toBeVisible({
        timeout: 20_000,
    })
    await unsupportedPage.getByTestId('menu_settings_button').click()
    await expect(unsupportedPage.getByTestId('settings_screen')).toBeVisible()
    await unsupportedPage.getByTestId('settings_item_security').click()
    await expect(
        unsupportedPage.getByTestId('vault-security-screen'),
    ).toBeVisible({ timeout: 20_000 })

    await expect(
        unsupportedPage.getByTestId('vault-security-change-password-section'),
    ).toBeVisible()
    await expect(
        unsupportedPage.getByTestId('vault-security-change-password-submit'),
    ).toBeVisible()

    // Absent, not merely disabled — the `passkeyState !== null` render guard.
    await expect(
        unsupportedPage.getByText('Passkey unlock', { exact: true }),
    ).not.toBeVisible()
    await expect(
        unsupportedPage.getByTestId('vault-security-passkey-toggle'),
    ).not.toBeVisible()
    await expect(
        unsupportedPage.getByTestId('vault-security-passkey-password'),
    ).not.toBeVisible()

    expect(unsupportedPageErrors, 'page threw an uncaught error').toEqual([])
    await unsupportedPage.close()
})

test('lock-now from vault security locks the wallet', async () => {
    await expect(page.getByTestId('vault-security-screen')).toBeVisible({
        timeout: 20_000,
    })
    await page.getByTestId('vault-security-lock-now').click()
    await expect(page.getByTestId('unlock-password-input')).toBeVisible({
        timeout: 20_000,
    })
})
