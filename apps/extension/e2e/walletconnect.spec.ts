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

// M7 milestone smoke: the WalletConnect settings graph (now the unified
// ConnectionsSettingsScreen, see EXTENSION_REVIEW_FOLLOWUPS.md 4.4 —
// originally SettingsWalletConnectScreen) + SigningOverlays' ConnectionView,
// newly mounted in WebMainRoutes) plus the Discover hand-off, on web for the
// first time in this bundle. Reuses the
// feature-tabs.spec.ts fixture shape: fresh profile, serial, onboard once in
// beforeAll. Network access is not assumed — a real WC v1 pairing needs a live
// bridge, so every WalletConnect assertion here targets a *networkless*
// terminal state (parseWalletConnectUri rejects a bridge-less URI outright;
// a syntactically valid but unreachable bridge fails the socket asynchronously,
// see useDeepLink.ts's WALLET_CONNECT case and useWalletConnect.ts's
// `connector.on('error', ...)`). Real pairing against a live dApp is Task 6's
// manual checklist. The Discover hand-off test runs on its own page (see its
// own comment below) rather than the shared `page` the other three tests use.
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
const PASSWORD = 'e2e-walletconnect-password-1'

// A syntactically valid WC v1 pairing URI (has a `bridge` param) pointed at a
// host `.invalid` TLD guarantees a DNS failure — no real network dependency,
// but `connect()` still constructs the client and attempts the bridge socket
// before failing, exactly like a real unreachable bridge would.
// (packages/walletconnect/src/hooks/useWalletConnect.ts / SettingsWalletConnectScreen).
const UNREACHABLE_BRIDGE_WC_URI =
    'wc:topic@1?bridge=https%3A%2F%2Funreachable.invalid&key=00'
// No `bridge` param at all: apps/mobile/src/hooks/deeplink/walletconnect-parser.ts's
// parseWalletConnectUri rejects this outright (returns null) before any
// connect() attempt is made.
const GARBAGE_WC_URI = 'wc:garbage-without-bridge'

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
// re-sliced, so every gated entry point calls this helper. NOTE: the
// WalletConnect settings screen (apps/mobile/src/modules/settings/routes/index.tsx)
// is registered WITHOUT withAgeGate, unlike Discover/Swap/Fund/Staking — so
// tests below only call this after tab_discover_button, never for the WC
// settings row.
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

// Settings row + screen: proves the WC settings graph (now the unified
// ConnectionsSettingsScreen — connectionsSettings capability, see
// EXTENSION_REVIEW_FOLLOWUPS.md 4.4) boots on web with no eval-time crash —
// this bundle is the first to contain it. testID scheme
// settings_item_${title...} (SettingsScreen.tsx) — 'Connections'
// (settings.main.connections_title) → settings_item_connections, verified
// against SettingsScreen.tsx and useSettingsOptions.ts.
test('connections settings row renders and the screen shows its empty state', async () => {
    await dismissPinPromptIfPresent(page)
    await clickThroughPinPrompt(page, page.getByTestId('tab_menu_button'))
    await expect(page.getByTestId('menu_screen')).toBeVisible({
        timeout: 20_000,
    })
    await clickThroughPinPrompt(page, page.getByTestId('menu_settings_button'))
    await expect(page.getByTestId('settings_screen')).toBeVisible({
        timeout: 20_000,
    })

    const connectionsRow = page.getByTestId('settings_item_connections')
    await connectionsRow.scrollIntoViewIfNeeded()
    await expect(connectionsRow).toBeVisible()
    await clickThroughPinPrompt(page, connectionsRow)

    await expect(page.getByTestId('connections_settings_screen')).toBeVisible({
        timeout: 20_000,
    })
    // A fresh wallet has no sessions or dapp connections —
    // ConnectionsSettingsScreen's PWFlatList renders ListEmptyComponent
    // (settings.connections.empty_title / empty_body, en.json), which has no
    // testID on the EmptyView itself — the rendered copy is the verified
    // proxy that the screen reached its empty-state terminal render rather
    // than crashing mid-mount.
    await expect(page.getByText('No connections', { exact: true })).toBeVisible(
        { timeout: 20_000 },
    )
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// Paste-flow terminal state: the empty-state's connect button
// (testID='connections_settings_connect_button', ConnectionsSettingsScreen.tsx)
// opens QRScannerView, a PWBottomSheet (testID='qr-scanner-sheet',
// QRScannerView.web.tsx) hosting QRScannerContent.web's paste field
// (testID='qr-paste-input') and submit button (testID='qr-paste-submit').
// Pasting a syntactically valid but unreachable-bridge WC URI makes
// isValidDeepLink() accept it (parseWalletConnectUri only requires a
// non-empty `bridge` param) so it's dispatched into handleDeepLink's
// WALLET_CONNECT case — connect() then either throws/times out (10s ceiling,
// useDeepLink.ts) or the connector's later 'error' event does (useWalletConnect.ts).
// Every one of those outcomes calls the dispatcher's onError/onConnectionError
// callback, which QRScannerContent.web maps to `onRestart` — never `onClose`
// — so the scanner sheet staying open is the deterministic (not racy) half of
// the bounded terminal state; a "WalletConnect failed" (deeplink timeout) or
// "Error" (store-level connectionError, useWalletConnectProvider.tsx) toast
// may additionally appear depending on which path resolves first, but is not
// required for this assertion.
test('pasting an unreachable-bridge WC URI reaches a bounded terminal state', async () => {
    await dismissPinPromptIfPresent(page)
    await clickThroughPinPrompt(
        page,
        page.getByTestId('connections_settings_connect_button'),
    )

    const scannerSheet = page.getByTestId('qr-scanner-sheet')
    await expect(scannerSheet).toBeVisible({ timeout: 20_000 })

    await page.getByTestId('qr-paste-input').fill(UNREACHABLE_BRIDGE_WC_URI)
    await clickThroughPinPrompt(page, page.getByTestId('qr-paste-submit'))

    // Bounded settle window for connect()'s async failure — see the
    // dedicated bridge-error comment above.
    await page.waitForTimeout(3000)

    await expect(scannerSheet).toBeVisible()
    await expect(
        page.getByText('SELECT ACCOUNTS', { exact: true }),
    ).not.toBeVisible()
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// Invalid URI rejected: no `bridge` param at all, so
// parseWalletConnectUri (apps/mobile/src/hooks/deeplink/walletconnect-parser.ts)
// returns null — isValidDeepLink() is false, so QRScannerContent.web's
// handleResult short-circuits straight to onRestart WITHOUT ever calling
// handleDeepLink (no connect() attempt, no dispatcher toast at all). Reuses
// the still-open scanner sheet from the previous test.
test('pasting a bridge-less WC URI is rejected and keeps the scanner open', async () => {
    const scannerSheet = page.getByTestId('qr-scanner-sheet')
    await expect(scannerSheet).toBeVisible({ timeout: 20_000 })

    await page.getByTestId('qr-paste-input').fill(GARBAGE_WC_URI)
    await clickThroughPinPrompt(page, page.getByTestId('qr-paste-submit'))

    await expect(scannerSheet).toBeVisible()
    await expect(
        page.getByText('SELECT ACCOUNTS', { exact: true }),
    ).not.toBeVisible()
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// Discover hand-off (networkless-tolerant). Runs on its OWN page rather than
// the shared `page` above: the same extension profile/keystore is already
// unlocked (verified — a fresh `context.newPage()` navigated to
// expanded.html lands directly on `account_screen`, no re-onboarding or PIN
// re-entry needed), and isolating it here sidesteps an unrelated, pre-existing
// flake this investigation turned up — visiting Discover on the SAME page
// that later opens the WC settings scanner intermittently surfaces a
// currencies/USD price-fetch rejection (Cloudflare WAF-blocks the staging API
// from this sandbox; unrelated to WalletConnect or this milestone's code) a
// few seconds later as an uncaught pageerror. Discover visited alone, with no
// subsequent Settings navigation on the same page, never reproduces it.
// Reuses discover.spec.ts's conditional-skip pattern: the iframe existing
// needs no network, but a same-origin bridge round-trip does, so this only
// runs its real assertion once the MAIN-world content script
// (discover-main.ts) has actually installed `peraMobileInterface` — which is
// also where the `window.open('wc:...')` hook is installed (same synchronous
// script body, no await between them).
test('discover hand-off routes an unreachable-bridge WC URI without crashing the shell', async () => {
    const discoverPage = await context.newPage()
    const discoverPageErrors = trackPageErrors(discoverPage)
    await discoverPage.goto(`chrome-extension://${extensionId}/expanded.html`)
    await expect(discoverPage.getByTestId('account_screen')).toBeVisible({
        timeout: 20_000,
    })

    await dismissPinPromptIfPresent(discoverPage)
    await clickThroughPinPrompt(
        discoverPage,
        discoverPage.getByTestId('tab_discover_button'),
    )
    await passAgeGateIfOffered(discoverPage)

    const frame = discoverPage
        .frames()
        .find(candidate => candidate.url().includes('peraBridgeToken='))
    // test.skip(condition, ...) throws to abort the test immediately when
    // true (see discover.spec.ts) — discoverPage is left for afterAll's
    // context.close() to reap rather than closed here.
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

    // discover-main.ts's window.open hook: an isWcUri() target is relayed as
    // a `walletConnect` bridge op instead of actually opening a window/tab.
    // usePeraWebviewInterface's openWalletConnect handler (web) parses it and
    // calls connect().catch(logger.error) — no toast on this path (unlike the
    // QR-scanner deep link path above), so "nothing visible happens" is
    // itself the expected bounded terminal state here.
    await frame!.evaluate(uri => {
        window.open(uri)
    }, UNREACHABLE_BRIDGE_WC_URI)

    // Bounded settle window for the async connect()/socket failure — long
    // enough to catch a wrongly-surfaced ConnectionView approval sheet
    // without hard-coding the bridge socket's own failure timing.
    await discoverPage.waitForTimeout(3000)

    // No testID exists on ConnectionView (apps/mobile/src/modules/walletconnect/
    // components/ConnectionView/ConnectionView.tsx) or its header — "SELECT
    // ACCOUNTS" (walletconnect.request.accounts_title, ConnectionViewHeader.tsx:166)
    // is unique to that approval flow's rendered header, so its absence is
    // the verified proxy for "no approval sheet appeared".
    await expect(
        discoverPage.getByText('SELECT ACCOUNTS', { exact: true }),
    ).not.toBeVisible()
    expect(discoverPageErrors, 'page threw an uncaught error').toEqual([])
    await discoverPage.close()
})
