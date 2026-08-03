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

// Smoke test for the WalletConnect settings graph and the Discover hand-off on
// web. Network access is not assumed: a real WC v1 pairing needs a live bridge,
// so every assertion here targets a networkless terminal state. Real pairing
// against a live dApp stays on the manual checklist.
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
const PASSWORD = 'e2e-walletconnect-password-1'

// A `.invalid` TLD guarantees DNS failure with no real network dependency,
// while still driving connect() through client construction and a socket
// attempt exactly as an unreachable bridge would.
const UNREACHABLE_BRIDGE_WC_URI =
    'wc:topic@1?bridge=https%3A%2F%2Funreachable.invalid&key=00'
// No `bridge` param, so parseWalletConnectUri rejects it before any connect().
const GARBAGE_WC_URI = 'wc:garbage-without-bridge'

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
// order isn't guaranteed. WC settings itself is not age-gated; Discover is.
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
})

test.afterAll(async () => {
    await context.close()
})

// Proves ConnectionsSettingsScreen boots on web with no eval-time crash.
// Settings testIDs derive from the row title: `settings_item_${title...}`.
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
    // A fresh wallet has no connections, and the empty state carries no
    // testID — the copy is the proxy for "reached a terminal render".
    await expect(page.getByText('No connections', { exact: true })).toBeVisible(
        { timeout: 20_000 },
    )
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// A valid-but-unreachable URI is accepted by isValidDeepLink and dispatched,
// then fails via connect()'s timeout or the connector's 'error' event. Both
// route to onRestart, never onClose — so the scanner sheet staying open is the
// deterministic half of the terminal state. A failure toast may or may not
// also appear depending on which path wins, so don't assert on it.
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

    // Bounded settle window for connect()'s async failure.
    await page.waitForTimeout(3000)

    await expect(scannerSheet).toBeVisible()
    await expect(
        page.getByText('SELECT ACCOUNTS', { exact: true }),
    ).not.toBeVisible()
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// With no `bridge` param, isValidDeepLink is false and handleResult
// short-circuits to onRestart without ever calling handleDeepLink — so no
// connect() attempt and no toast at all. Reuses the still-open scanner sheet.
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

// Runs on its OWN page: visiting Discover on the same page that later opens
// the WC scanner intermittently surfaces an unrelated price-fetch rejection as
// an uncaught pageerror. Discover alone never reproduces it.
//
// The iframe existing needs no network but a bridge round-trip does, so the
// real assertion is gated on discover-main.ts having installed
// `peraMobileInterface` — the same script body that installs the window.open
// hook this test drives.
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
    // test.skip throws to abort, so discoverPage is left for afterAll to reap.
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

    // A wc: target is relayed as a `walletConnect` bridge op rather than
    // opening a tab, and the web handler swallows the failure into the log —
    // so "nothing visible happens" IS the expected terminal state here.
    await frame!.evaluate(uri => {
        window.open(uri)
    }, UNREACHABLE_BRIDGE_WC_URI)

    // Long enough to catch a wrongly-surfaced approval sheet, without
    // hard-coding the bridge socket's own failure timing.
    await discoverPage.waitForTimeout(3000)

    // ConnectionView has no testID, so its unique header copy stands in for
    // "no approval sheet appeared".
    await expect(
        discoverPage.getByText('SELECT ACCOUNTS', { exact: true }),
    ).not.toBeVisible()
    expect(discoverPageErrors, 'page threw an uncaught error').toEqual([])
    await discoverPage.close()
})
