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

// M3 milestone-close smoke: a funded-account-free happy path through the
// real shell — onboard, portfolio home, menu -> settings, and lock from
// vault security. Reuses the onboarding.spec.ts fixture shape (fresh
// profile, serial) but drives further into the shell than that spec does.
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
const PASSWORD = 'e2e-wallet-smoke-password-1'

// Module-eval crashes in the extension bundle otherwise surface as bare
// selector timeouts with no indication of the real cause (see onboarding.spec.ts).
const trackPageErrors = (targetPage: Page): Error[] => {
    const errors: Error[] = []
    targetPage.on('pageerror', error => errors.push(error))
    return errors
}

// Closes a PWBottomSheet.web.tsx Modal by clicking the backdrop above the
// sheet's own bounds (the sheet is bottom-anchored and capped at
// SHEET_MAX_RATIO, so a point near the top of the viewport is always backdrop,
// never sheet content) rather than Escape, which RNW's Modal doesn't wire to
// onRequestClose on web.
const dismissSheet = async (targetPage: Page): Promise<void> => {
    await targetPage
        .getByTestId('pw-bottom-sheet-backdrop')
        .click({ position: { x: 10, y: 10 } })
}

// PromptContainer (modules/prompts) shows a one-time security nudge
// LONG_PROMPT_DISPLAY_DELAY (3s) after the account exists — unrelated to the
// M3 rendering-cluster fixes below, but real enough that this suite's own
// runtime can cross that delay. Dismiss it if it showed up so it doesn't
// intercept the next click.
const dismissPinPromptIfPresent = async (targetPage: Page): Promise<void> => {
    const notNow = targetPage.getByTestId('pin_security_prompt_not_now_button')
    if (await notNow.isVisible().catch(() => false)) {
        await notNow.click()
    }
}

// Bounded retry-and-dismiss click (ported from feature-tabs.spec.ts, where
// M5 generalized this file's narrower openMoreSheet pattern): the pin prompt
// fires on a wall-clock delay, so it can appear BETWEEN a dismiss check and
// the click it was guarding — the click then retries forever against the
// prompt's overlay. Every click downstream of a wait should go through this.
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
    // locator that's genuinely stuck should fail with a clear timeout instead
    // of exhausting the whole test's budget.
    await locator.click({ timeout: 10_000 })
}

// The pin-security prompt above fires on a wall-clock delay from account
// creation (not from any state a given test controls), so it can race in
// right as a test clicks `more_button` and swallow that click instead of
// opening the sheet — the click lands on the prompt's overlay, not the
// button underneath. Retry through it rather than asserting on a single
// click, since which test happens to be running when the delay elapses is
// non-deterministic.
// RoundButton (components/RoundButton/RoundButton.tsx) renders its title
// PWText as a SIBLING of the PWTouchableOpacity, not a child — the tap
// target is the icon circle above the label. Click that touchable element
// directly (first child of the shared container) rather than guessing a
// pixel offset above the label: the JS page-stack on web lays the card out
// with a slightly different vertical offset than native-stack, so a fixed
// coordinate heuristic misses the icon.
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

    // Pre-dismiss two wall-clock-delayed, first-use-only nudges so they can
    // never race a later test's actions or leak an open overlay into the
    // next test in this serial file:
    //  - PromptContainer's PIN-security nudge (modules/prompts) fires
    //    LONG_PROMPT_DISPLAY_DELAY (3s) after the account exists.
    //  - InputScreen's "Transacting Tips" interstitial (send-funds) fires
    //    SHORT_PROMPT_DISPLAY_DELAY after mount, gated on the SAME
    //    settings-store preferences the PIN nudge uses (getPreference(
    //    UserPreferences.transactionInfoAgreed) = 'transaction-info-agreed').
    // Both are reactively handled elsewhere too (dismissPinPromptIfPresent /
    // clickThroughPinPrompt, the "I Understand" check in the Send-sheet
    // test), but those only guard the click they wrap — a delay firing
    // later (e.g. after the Send-sheet test's own checks finish) leaves the
    // interstitial open and blocks the NEXT test's very first click. Seeding
    // both preferences true makes each gate's `!pref` check false on first
    // render, so neither ever mounts instead of racing them reactively. Same
    // trick as pera-card.spec.ts's remote-config override seed.
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

    // Onboard exactly as onboarding.spec.ts: create password -> terms ->
    // create wallet -> name account -> home. Done once in beforeAll so the
    // three tests below can each assert on a stable, already-onboarded shell.
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

    // ALGO is a persisted holding row (account_asset_holdings) written by the
    // account-syncer once it hits the real algod/indexer backend
    // (packages/accounts/src/sync/account-syncer.ts) — a fresh account has
    // zero local holdings until that network round-trip completes; there is
    // no local seed at creation time. In a networked run the row's ticker
    // renders as the exact text 'ALGO' (AssetItemView's subtitle, from
    // ALGO_ASSET_NAME) below the 'Algo' title.
    //
    // If CI/sandbox networklessness blocks the sync (offscreen DB host can't
    // reach algod/indexer), AccountAssetList (apps/mobile/src/modules/
    // accounts/components/AccountAssetList/AccountAssetList.tsx:177-186)
    // falls through from its loading skeleton (isPending, no testID) to the
    // real empty state once isPending settles false: EmptyView rendering
    // t('account_details.assets.empty_title') = 'No Assets'. That text node
    // only exists post-settle, so waiting on it (rather than on account_screen,
    // which is present even mid-skeleton) is what proves we're past the
    // loading skeleton and not just racing it. Both the ALGO row and the
    // empty state are terminal, non-skeleton states — assert on whichever
    // one actually rendered, per the funded-account-free contract.
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

// User-feedback #3 (SearchableList unpin-on-scroll, web): the pinned search
// input stayed glued to the top on web because react-native-web's ScrollView
// never emits onScrollBeginDrag/onScrollEndDrag (only onScroll/onTouchMove/
// onWheel), so the native unpin-on-drag handler never fires. The web-gated
// fix in useSearchableList.ts drives unpin off onScroll instead. This is
// covered by unit tests in useSearchableList.spec.ts, which drive handleScroll
// with exact offsets and assert the unpin (and that native is unaffected) — an
// e2e can't exercise it: a fresh no-network account has no scrollable asset
// content, so the list never scrolls past the pin offset in the harness.

// Regression guard (M3 rendering-cluster, icon clipping): react-native-svg
// icons that use an internal clipPath (most of them) got their `id`
// minified by SVGO's `cleanupIds` sub-plugin independently *per file* —
// nearly all icons have exactly one clipPath, so nearly every icon file
// ended up with the literal id "a". Invisible on native (RN's SVG renderer
// resolves `url(#a)` per-SVG, not against a shared namespace), but on web
// react-native-svg mounts real DOM, so every icon instance's defs land in
// the one document-wide id namespace — `url(#a)` resolves to whichever
// icon's `id="a"` happens to be first in DOM order, clipping icons (e.g. the
// assets-search magnifying glass) to an unrelated shape. Fixed in
// apps/mobile/metro-raw-transformer.js (web-platform-gated): SVGO's built-in
// "prefixIds" plugin now salts every id with a token derived from the
// source file's *full* path (not just its basename — the basename alone
// still collides for files that share a name in different directories,
// e.g. assets/icons/algo.svg vs assets/icons/assets/algo.svg, which is
// exactly the pair co-rendered on this portfolio-home page as the Buy-Algo
// glyph and the search magnifier).
//
// Asserting `[id="a"]` is empty (the original guard) no longer proves
// anything post-fix: ids are now prefixed, so none of them is literally
// "a" regardless of whether the prefix scheme is actually collision-free.
// The real invariant is "no two elements on the page share an id" — assert
// that directly, right here on the portfolio-home page (still the active
// screen right after the previous test), where the colliding icons are
// co-rendered (more/receive/search icons alongside the Algo row glyph).
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

// Regression guard (M3 rendering-cluster): every bottom sheet content
// component using PWSheetLayout (~50 call sites, incl. AccountOptionsContent
// below) rendered `BottomSheetScrollView` from `@gorhom/bottom-sheet`
// unconditionally. That's safe on native (always reached through the real
// gorhom `<BottomSheet>`), but PWBottomSheet.web.tsx renders a plain Modal —
// no gorhom provider ever exists on web — so the hook backing that component
// threw `'useBottomSheetInternal' cannot be used out of the BottomSheet!`,
// an uncaught error with no root boundary that unmounted the entire React
// app (not just the sheet), presenting as a blank white page. Fixed by
// apps/mobile/src/components/core/PWSheetLayout/PWSheetLayout.web.tsx (a
// plain-ScrollView web twin). Assert real content renders, not just that no
// error was thrown.
test('the More sheet (PWSheetLayout) renders real content, not blank', async () => {
    await expect(page.getByTestId('account_screen')).toBeVisible({
        timeout: 20_000,
    })
    await openMoreSheet(page)
    await expect(page.getByText('Show Address', { exact: true })).toBeVisible()
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
    await dismissSheet(page)
})

// User-feedback #4: toasts (react-native-notifier) fired but never rendered
// on web because AppShell.web.tsx never mounted a `NotifierWrapper` host —
// `Notifier.showNotification` silently no-ops with no host in the tree
// (native's App.tsx has always mounted one). Fixed by mounting
// `NotifierWrapper` in AppShellContent, matching native's placement. "Copy
// Address" (useClipboard.ts -> useToast().showToast) is the concrete
// repro from the user report: copy succeeds but no confirmation appears.
// Assert the toast text both appears and auto-dismisses (react-native-notifier's
// DEFAULT_DURATION is 3000ms + a 300ms hide animation).
test('copy address shows a toast that auto-dismisses', async () => {
    await expect(page.getByTestId('account_screen')).toBeVisible({
        timeout: 20_000,
    })
    await openMoreSheet(page)
    await page.getByText('Copy Address', { exact: true }).click()

    // react-native-notifier renders the notification via a `translateY`
    // transform, not by mounting/unmounting — the text node stays in the DOM
    // the whole time, so Playwright's toBeVisible() (attached + non-empty box
    // + not display:none/opacity:0) stays true even once it's animated off
    // screen. Assert on the actual on-screen position instead: it settles at
    // a non-negative Y while shown, then moves back above the viewport once
    // DEFAULT_DURATION (3000ms) plus the 300ms hide animation elapse.
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

// Regression guard (M3 rendering-cluster): ReceiveFundsContent nests its own
// NavigationContainer + `@react-navigation/stack` (JS "Stack") Navigator.
// That navigator's web output (CardStack -> MaybeScreenContainer -> Card ->
// CardContent) depends on a chain of `flex: 1` Views resolving a real pixel
// height via CSS; nested inside PWBottomSheet.web.tsx's Modal, one link in
// that chain collapsed to `height: 0` (confirmed via DOM inspection — the
// real content rendered underneath at plausible-looking coordinates, but an
// ancestor's `{flex: 1, overflow: 'hidden'}` from CardContent clipped it all
// away). `@react-navigation/native-stack` doesn't hit this — its web screens
// are plain Views with no such measure-then-clip step, matching
// WebMainRoutes (routes/WebMainRoutes.tsx). Fixed via
// ReceiveFundsRoutes.web.tsx, swapping just this nested sheet navigator to
// native-stack.
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

// User-feedback #5: the receive address (a 58-char unbroken base32 string,
// no spaces) rendered on one un-wrapped line and overflowed the sheet
// instead of wrapping like native. Root cause: QRViewScreen's CopyableText
// wraps the address in a PWTouchableOpacity with no width of its own, inside
// `addressContainer`'s `alignItems: 'center'`. Yoga (native) still resolves
// a definite available width for a centered, unconstrained flex child, so
// native Text always wrapped; CSS flexbox (react-native-web) instead sizes
// that child to its content's natural (unwrapped) width, so there was never
// a bounded box for `overflow-wrap: break-word` (react-native-web's Text
// default) to wrap within. Fixed by giving the CopyableText wrapper
// `alignSelf: 'stretch'` (QRViewScreen/styles.ts `addressButton`), which
// gives it addressContainer's real width on both platforms — a no-op for
// native (Yoga already wrapped correctly) beyond a larger, arguably more
// tappable copy target, and the fix on web. This one component is the
// concrete deliverable; whether react-native-web's Text broadly fails to
// wrap other unbroken-string content (ids, hashes, urls) that also lacks a
// definite-width ancestor is a follow-up worth auditing separately — not
// fixed generally here.
test('the receive address wraps instead of overflowing the sheet', async () => {
    // The 465-484px natural (unwrapped) width of the address comfortably
    // fits inside this suite's wide expanded.html viewport (1280px) even
    // pre-fix — the overflow is only visible at the real extension popup's
    // fixed 360x600 (popup-sizing.spec.ts), so this test drives a fresh page
    // at that width instead of reusing the shared `page`. chrome.storage
    // (and so the already-onboarded vault) is shared across pages in the
    // same persistent context, so popup.html opens straight to account_screen.
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
    // Single-account fixture (onboarding.spec.ts shape): exactly one row.
    // Prefix matches AccountSelectionScreen.tsx's rowTestIDPrefix='receive_account_row'.
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

// User-feedback #1: the send-funds bottom sheet opened blank. Same root
// cause class as the Receive sheet above: SendFundsRoutes.tsx nests the same
// collapse-prone `@react-navigation/stack` navigator, with no `.web.tsx`
// twin swapping it to native-stack. Fixed by SendFundsRoutes.web.tsx,
// mirroring ReceiveFundsRoutes.web.tsx exactly.
//
// This drives the flow via an asset's own "Send" action (AssetActionButtons),
// which pre-selects an asset and lands on InputScreen (a keypad layout, not
// a FlashList) rather than the FlashList-backed AssetSelectionScreen that
// the home tab's asset-less Send button (ButtonPanel, gated behind a funded
// account — unreachable in this funded-account-free harness) would hit
// first. Both screens are rendered through the same nested navigator this
// fix replaces, so this still exercises — and locks in — the fix.
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

    // First-use-only "Transacting Tips" interstitial (prompts module,
    // unrelated to this fix) may appear before the real SendFundsContent
    // sheet — dismiss it if present so the real content check below isn't
    // just checking the interstitial's own content.
    const iUnderstand = page.getByText('I Understand', { exact: true })
    if (await iUnderstand.isVisible({ timeout: 3000 }).catch(() => false)) {
        await iUnderstand.click()
    }

    // send_funds.input_view.title = 'Send {{asset}}' -> InputScreen's header.
    await expect(page.getByText('Send Algo', { exact: true })).toBeVisible({
        timeout: 20_000,
    })
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
    // The wall-clock PIN-security prompt (see dismissPinPromptIfPresent) may
    // have raced in by now, covering the sheet's own backdrop — clear it
    // first so the backdrop click below isn't intercepted by it.
    await dismissPinPromptIfPresent(page)
    await dismissSheet(page)
})

// User-feedback #6: "Add account" from the portfolio menu opened a brand-new
// browser tab (WebMainRoutes mounted createExpandedRedirect('add-account') in
// the popup), which severed the in-extension flow. Product decision: navigate
// in-place on every surface. This drives a fresh popup-sized page so the
// assertion holds at the real 360x600 popup too, opens the account switcher,
// taps Add account, and asserts the AddAccount home renders IN THE SAME page
// (not the `expanded-redirect` stand-in) and that no second tab was spawned.
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

    // In-place: the AddAccount home renders in this same page. Pre-fix the
    // popup instead mounted the redirect stand-in (`expanded-redirect`) and
    // handed off to a new expanded tab.
    await expect(
        popupPage.getByTestId('add_account_import_button'),
    ).toBeVisible({ timeout: 20_000 })
    await expect(popupPage.getByTestId('expanded-redirect')).toHaveCount(0)

    // No new tab was spawned by the navigation.
    expect(context.pages().length).toBe(tabsBefore)

    expect(popupPageErrors, 'page threw an uncaught error').toEqual([])
    await popupPage.close()
})

// User-feedback #7: two portfolio-home header affordances were dead on web
// because neither `Search` nor `Messages` was registered in WebMainRoutes —
// the navigations silently no-op'd. Now wired as in-place stack screens (like
// Settings/Contacts), so both navigate inside the popup's own navigator.
//
// (a) The ellipsis (⋯) menu's Search item. AccountHeaderMenu wraps a PWIcon
// 'ellipsis' in a PWTouchableOpacity inside PWView testID
// 'account_screen_dropdown'; clicking it runs PWDropdown.handleOpen, which
// renders the items in a Modal. Selecting the Search item
// (label search.title = 'Search') must land on SearchScreen — whose
// SearchInput carries testID 'search_input' — in the same page, with no new
// tab spawned and no uncaught error (the entry screen's graph must be
// web-safe).
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

// (b) The notifications bell (NotificationsIcon, testID 'notifications_icon',
// hardcoded on its PWTouchableOpacity) must open the Messages screen —
// MessagesScreen renders an Inbox/Notifications material-top-tab bar (via the
// react-native-pager-view web shim) — in the same page, no new tab, no
// uncaught error. Asserting on both tab labels proves the tab navigator's
// entry screen rendered real content, not a blank crash.
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

// User-feedback #3: the header QR icon. Decision was to KEEP it and route to
// a camera-in-tab hand-off (the 360x600 popup can't host getUserMedia's
// focus-stealing permission dialog). In the popup surface, QRScannerView.web
// renders a "scan with camera" button (hands off to the expanded tab via
// openExpandedTab) plus a working paste fallback — never a blank sheet or an
// inline auto-starting camera. Must be driven on a real popup-surface page
// (popup.html sets __PERA_SURFACE__='popup'); the shared `page` is expanded.
test('the header QR icon opens the camera-in-tab hand-off, not a blank sheet', async () => {
    const popupPage = await context.newPage()
    const popupPageErrors = trackPageErrors(popupPage)
    await popupPage.setViewportSize({ width: 360, height: 600 })
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`)
    await expect(popupPage.getByTestId('account_screen')).toBeVisible({
        timeout: 20_000,
    })
    await dismissPinPromptIfPresent(popupPage)

    await popupPage.getByTestId('account_screen_qr_scanner_button').click()

    // Real content: the camera hand-off button and the paste fallback both
    // render (not a blank PWSheetLayout, not an inline auto-start camera).
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

    // User-feedback round 2 #2: PWScreen's flex chain needs minHeight:0 on
    // web for the scroll body to get a bounded height inside the popup's
    // overflow:hidden viewport — without it the screen didn't scroll at all.
    const removeAll = page.getByTestId('settings_remove_all_accounts_button')
    await removeAll.scrollIntoViewIfNeeded()
    await expect(removeAll).toBeInViewport()
})

// User-feedback round 3 #1: the expanded-tab scroll check is a false
// positive (full-height tab, nothing overflows). The popup's fixed 600px
// viewport is where scrolling actually broke: web CardContent's
// content-hugging page box grew stacked screens to content height until
// createAppStackNavigator.web bounded cards with cardStyle flex:1.
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

// User-feedback #8 (reversed): this test originally asserted the passkey
// section stayed visible-but-disabled when unsupported, so it was
// discoverable even as dead UI. That reasoning no longer holds: the root
// cause was isPasskeyUnlockSupported() checking the wrong capability key
// (`prf` instead of WebAuthn L3's `extension:prf`), which made it resolve
// false on every real Chromium — the "helpful" disabled state was actually
// masking a bug, not describing a real limitation. The product call, now
// that detection is fixed, is to hide the section entirely rather than show
// permanently-broken UI in the rare case it's genuinely unsupported.
//
// Verified by direct `PublicKeyCredential.getClientCapabilities()`
// evaluation against this same extension page: real (including headless/CI)
// Chromium reports `"extension:prf": true` even with
// `"userVerifyingPlatformAuthenticator": false` (no real platform
// authenticator here) — `extension:prf` is a client-software capability
// flag, not proof a real authenticator is attached. So the test below hits
// the SUPPORTED path exactly as a real user would. The two tests together
// cover the render conditional (`passkeyState !== null`) on both sides: this
// one exercises supported (no stubbing — the real capability resolution),
// the next one below forces unsupported via an `addInitScript` stub of
// `getClientCapabilities` installed before the page's own scripts run, since
// that's the only way to reliably reach that branch against real Chromium.
test('vault security settings surface change-password and passkey sections', async () => {
    // Settings item testIDs are generated from each item's title:
    // `settings_item_${title.toLowerCase().replace(/\s+/g, '_')}`
    // (SettingsScreen.tsx:52). The "Security" row's title comes from the
    // i18n key settings.main.security_title, which resolves to "Security" —
    // giving 'settings_item_security'. Pinned after reading the source
    // directly (headed run confirmed the same DOM).
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

    // Passkey section: supported here (see comment above), so it renders
    // with the disabled-state password field and a toggle that starts
    // disabled because no password has been entered yet.
    await expect(
        page.getByText('Passkey unlock', { exact: true }),
    ).toBeVisible()
    await expect(
        page.getByTestId('vault-security-passkey-password'),
    ).toBeVisible()
    const passkeyToggle = page.getByTestId('vault-security-passkey-toggle')
    await expect(passkeyToggle).toBeVisible()
    // PWButton (RN Pressable on web) marks disabled via aria-disabled, not
    // the native `disabled` attribute — toBeDisabled() checks the latter and
    // doesn't apply here.
    await expect(passkeyToggle).toHaveAttribute('aria-disabled', 'true')

    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// Forces the unsupported branch of isPasskeyUnlockSupported() by stubbing
// getClientCapabilities before the page's own scripts run (addInitScript
// runs prior to any script on the document, including the extension
// bundle's mount-time capability check). Runs on its own page/tab so it
// doesn't disturb the shared `page` used by the rest of this suite; the
// vault is already onboarded in this context from beforeAll, so this page
// opens straight into the unlocked shell.
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

    // Change-password still renders unconditionally...
    await expect(
        unsupportedPage.getByTestId('vault-security-change-password-section'),
    ).toBeVisible()
    await expect(
        unsupportedPage.getByTestId('vault-security-change-password-submit'),
    ).toBeVisible()

    // ...while the passkey section is entirely absent — this is the
    // `passkeyState !== null` render guard actually being exercised, not
    // just asserted-by-omission.
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
