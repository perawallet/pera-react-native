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
import {
    expectApprovalSurfaceUrl,
    openApprovalSurface,
    trackPageErrors,
} from './approval-surface'
import algosdk from 'algosdk'
import WalletConnect from '@perawallet/walletconnect'
import { getNetworkConfig, Networks } from '@perawallet/wallet-core-config'
import { startFakeBridge } from './fixtures/fake-wc-bridge.mjs'

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)

test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let extensionId: string
let page: Page
let pageErrors: Error[]
// WCDIAG: temporary instrumentation, remove before commit.
let swWorker: { evaluate: <T>(fn: () => T) => Promise<T> } | undefined
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
/**
 * `qr-paste-input` is a CONTROLLED PWInput, and `submitPasted` reads the React
 * state rather than the DOM node — with `if (!trimmed) return`, so submitting
 * before React commits the change event dispatched by `fill()` is a SILENT
 * no-op. Nothing dispatches, nothing throws, and the test dies much later on
 * whatever it was waiting for. Reopening the sheet widens the window enough to
 * lose it, because `fill()` then lands on a freshly mounted input mid
 * enter-animation.
 *
 * Asserting the value once is not enough: that reads the DOM, which `fill()`
 * has already set, so it can pass while the state update is still pending.
 * Because the input is controlled, a render that never took the change resets
 * the node to empty — so confirming the value again across a frame boundary is
 * what proves React holds it. Never `fill()` this input directly.
 */
const fillPasteInput = async (targetPage: Page, uri: string): Promise<void> => {
    const input = targetPage.getByTestId('qr-paste-input')
    await expect(input).toBeVisible()
    await input.fill(uri)
    await expect(input).toHaveValue(uri)
    await targetPage.evaluate(
        () =>
            new Promise(resolve => {
                requestAnimationFrame(() => resolve(null))
            }),
    )
    await expect(input).toHaveValue(uri)
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

    // WCDIAG: temporary instrumentation, remove before commit. Playwright does
    // not surface service-worker console output, so tee it into a global the
    // test can read back on failure.
    await serviceWorker
        .evaluate(() => {
            const sink: string[] = []
            ;(globalThis as unknown as { __wcdiag: string[] }).__wcdiag = sink
            const original = console.log.bind(console)
            console.log = (...args: unknown[]) => {
                try {
                    sink.push(
                        args
                            .map(a =>
                                typeof a === 'string' ? a : JSON.stringify(a),
                            )
                            .join(' '),
                    )
                } catch {
                    sink.push('<unserializable>')
                }
                original(...args)
            }
        })
        .catch(() => {})
    swWorker = serviceWorker

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

    await fillPasteInput(page, UNREACHABLE_BRIDGE_WC_URI)
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

    await fillPasteInput(page, GARBAGE_WC_URI)
    await clickThroughPinPrompt(page, page.getByTestId('qr-paste-submit'))

    await expect(scannerSheet).toBeVisible()
    await expect(
        page.getByText('SELECT ACCOUNTS', { exact: true }),
    ).not.toBeVisible()
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

// SKIPPED with the Discover tab: it is not registered on web while Discover's
// feature-gate map lacks a 'web' key. The window.open('wc:...') hook this
// covers (discover-main.ts) is unchanged. See
// routes/capabilities.web.ts's discoverTab comment.
//
// Runs on its OWN page: visiting Discover on the same page that later opens
// the WC scanner intermittently surfaces an unrelated price-fetch rejection as
// an uncaught pageerror. Discover alone never reproduces it.
//
// The iframe existing needs no network but a bridge round-trip does, so the
// real assertion is gated on discover-main.ts having installed
// `peraMobileInterface` — the same script body that installs the window.open
// hook this test drives.
test.skip('discover hand-off routes an unreachable-bridge WC URI without crashing the shell', async () => {
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

// The end-to-end proof the whole headless-WalletConnect design exists for.
// Everything above this point is deliberately networkless (see
// the file header); a real paired session and a real inbound sign request
// need a real WC v1 bridge, so this block spins up a local one
// (fixtures/fake-wc-bridge.mjs — pub/sub over topics with offline queueing,
// the same semantics the real Pera bridge implements) and drives the OTHER
// side of the handshake with the real `@perawallet/walletconnect` client
// (the same package `createWalletConnectConnector`, packages/walletconnect/
// src/connection/createConnector.ts, wraps for the wallet side) rather than
// hand-rolling the WC v1 wire frames or its payload encryption — the dApp
// role this client plays needs no browser globals (WebSocket/crypto.
// getRandomValues are both native in Node >= 22; window/localStorage are
// optional and no-op when absent), so it runs directly in this Playwright
// test process.
test.describe('offscreen ownership of a real WC v1 session (Task 11)', () => {
    let bridge: Awaited<ReturnType<typeof startFakeBridge>>
    let dappConnector: WalletConnect
    let approvedAddress: string

    const openWcApproval = () =>
        openApprovalSurface({ context, page, extensionId })

    // The dApp-side connector's own proof that approveSession actually
    // reached it over the bridge — resolves with the accounts the wallet
    // granted, straight off the real WC v1 `connect` event.
    const waitForConnectorConnect = (
        connector: WalletConnect,
    ): Promise<{ accounts: string[] }> =>
        new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('WalletConnect connect event timed out'))
            }, 20_000)
            connector.on('connect', (error: Error | null, payload: unknown) => {
                clearTimeout(timer)
                if (error) {
                    reject(error)
                    return
                }
                const accounts = (
                    payload as { params?: [{ accounts?: unknown }] } | null
                )?.params?.[0]?.accounts
                resolve({
                    accounts: Array.isArray(accounts)
                        ? accounts.filter(
                              (a): a is string => typeof a === 'string',
                          )
                        : [],
                })
            })
        })

    test.afterAll(async () => {
        dappConnector?.transportClose()
        await bridge?.close()
    })

    test('session survives the popup closing', async () => {
        bridge = await startFakeBridge()
        // No `uri` option: passing `bridge` (and no `uri`) is what makes this
        // the DAPP/INITIATOR side of the same class the wallet side uses —
        // see createWalletConnectConnector, which passes `uri` instead.
        dappConnector = new WalletConnect({
            bridge: bridge.url,
            clientMeta: {
                name: 'Fake E2E DApp',
                description: 'Task 11 e2e fixture',
                url: 'https://fake-e2e-dapp.test',
                icons: [],
            },
        })
        // Wildcard chainId (4160, AlgorandChainId.all) — isChainIdAcceptable
        // always accepts it, so pairing doesn't depend on which network the
        // extension happens to be running against.
        await dappConnector.createSession({ chainId: 4160 })
        const uri = dappConnector.uri

        // The prior two networkless tests in this file leave the scanner
        // sheet open, and QRScannerContent.web's `handlingRef` synchronous
        // double-fire guard from the last of those dispatches (an
        // unreachable-bridge connect() attempt) can still be latched — it
        // only clears when that deep-link path settles, up to
        // useWalletConnectPairing.web's WC_PAIR_TIMEOUT_MS (~10s) ceiling.
        // A fill+submit into a still-latched instance is silently swallowed,
        // so close the sheet (the backdrop press unmounts QRScannerContent.web
        // — PWBottomSheet.web only renders children while `isRendered`, which
        // it clears once its close animation finishes) and reopen it fresh,
        // guaranteeing a new `handlingRef` before this pairs for real.
        const scannerSheet = page.getByTestId('qr-scanner-sheet')
        // Retry the backdrop press until the sheet actually unmounts: a single
        // click can land mid enter-animation or on a nudge that raced over the
        // backdrop, and a miss here leaves the scanner open so the reopen below
        // never fires — surfacing as a bare timeout on this test.
        for (let attempt = 0; attempt < 5; attempt++) {
            if (!(await scannerSheet.isVisible().catch(() => false))) break
            await dismissPinPromptIfPresent(page)
            await page
                .getByTestId('pw-bottom-sheet-backdrop')
                .click()
                .catch(() => {})
            const closed = await scannerSheet
                .waitFor({ state: 'hidden', timeout: 2000 })
                .then(() => true)
                .catch(() => false)
            if (closed) break
        }
        await expect(scannerSheet).not.toBeVisible({ timeout: 5000 })
        await clickThroughPinPrompt(
            page,
            page.getByTestId('connections_settings_connect_button'),
        )
        await expect(scannerSheet).toBeVisible({ timeout: 20_000 })

        // The real product path: paste the URI into QRScannerContent.web's
        // field exactly as a user would, rather than dispatching a
        // `pera-wc-control` pair message directly. This is what drives
        // QRScannerContent.web -> useDeepLink -> useWalletConnectPairing.web
        // -> offscreen.
        await fillPasteInput(page, uri)
        console.log('[WCDIAG] about to click qr-paste-submit')
        await clickThroughPinPrompt(page, page.getByTestId('qr-paste-submit'))
        console.log('[WCDIAG] clicked qr-paste-submit')

        // useWalletConnectPairing.web's `pair` control message is now in
        // flight to offscreen; offscreen constructs the wallet-side
        // connector, subscribes, and — once the fake bridge flushes the
        // queued wc_sessionRequest createSession() published before the
        // wallet ever subscribed — asks the SW for approval, which
        // registers the pending approval this waits for. Either surface is a
        // pass: with `page` still open ApprovalWindowBridge's
        // chrome.action.openPopup() usually succeeds and the entry keeps
        // surface:'popup', but it legitimately falls back to the window (see
        // the mechanism note on the window-fallback test below, and
        // openApprovalSurface). What this test is about is that the session
        // survives the popup closing, not which surface Chrome gave us.
        // WCDIAG: temporary instrumentation, remove before commit.
        let opened
        try {
            opened = await openWcApproval()
        } catch (error) {
            const swLog = await swWorker
                ?.evaluate(
                    () =>
                        (globalThis as unknown as { __wcdiag?: string[] })
                            .__wcdiag ?? ['<no sink>'],
                )
                .catch((e: unknown) => [`<sw evaluate failed: ${String(e)}>`])
            console.log(
                '[WCDIAG] service-worker log:\n  ' +
                    (swLog ?? ['<no worker>']).join('\n  '),
            )
            throw error
        }
        const { approvalPage, approvalErrors } = opened
        expectApprovalSurfaceUrl(approvalPage)

        const unlockInput = approvalPage.getByTestId('unlock-password-input')
        if (await unlockInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await unlockInput.fill(PASSWORD)
            await approvalPage.getByTestId('unlock-submit').click()
        }

        // 'wc-connect' renders WcConnectScreen — the web twin of mobile's
        // ConnectionView — not the ARC-0027 EnableRequestScreen
        // (DappRequestRoutes.web.tsx).
        await expect(
            approvalPage.getByTestId('wc-connect-peer-name'),
        ).toBeVisible({
            timeout: 20_000,
        })
        const connectButton = approvalPage.getByTestId('wc-connect-connect')
        const alreadySelected =
            (await connectButton.getAttribute('aria-disabled')) !== 'true'
        if (!alreadySelected) {
            await expect(
                approvalPage.getByRole('checkbox').first(),
            ).toBeVisible({
                timeout: 20_000,
            })
            await approvalPage.getByRole('checkbox').first().click()
        }
        await expect(connectButton).not.toHaveAttribute('aria-disabled', 'true')

        const connected = waitForConnectorConnect(dappConnector)
        await connectButton.click()
        const { accounts } = await connected
        expect(accounts.length).toBeGreaterThan(0)
        approvedAddress = accounts[0]

        await approvalPage.close()
        expect(
            approvalErrors,
            'approval popup threw an uncaught error',
        ).toEqual([])

        // The moment of truth: close EVERY extension page — the one that
        // initiated pairing and the approval popup alike — then reopen
        // popup.html fresh. persistConnection only runs after approveSession
        // resolves against a live offscreen socket, so the session row still
        // being listed below proves offscreen wrote that record and the
        // write survived into a freshly-hydrated surface — not that either
        // closed page was holding it. Socket *liveness* (offscreen still
        // subscribed, not just a persisted row) is what the next test
        // proves, not this assertion.
        for (const openPage of context.pages()) {
            await openPage.close()
        }
        expect(context.pages()).toHaveLength(0)

        const freshPopup = await context.newPage()
        await freshPopup.setViewportSize({ width: 360, height: 600 })
        const freshErrors = trackPageErrors(freshPopup)
        await freshPopup.goto(`chrome-extension://${extensionId}/popup.html`)

        const freshUnlock = freshPopup.getByTestId('unlock-password-input')
        if (await freshUnlock.isVisible({ timeout: 5000 }).catch(() => false)) {
            await freshUnlock.fill(PASSWORD)
            await freshPopup.getByTestId('unlock-submit').click()
        }
        await expect(freshPopup.getByTestId('account_screen')).toBeVisible({
            timeout: 20_000,
        })

        await clickThroughPinPrompt(
            freshPopup,
            freshPopup.getByTestId('tab_menu_button'),
        )
        await expect(freshPopup.getByTestId('menu_screen')).toBeVisible({
            timeout: 20_000,
        })
        await clickThroughPinPrompt(
            freshPopup,
            freshPopup.getByTestId('menu_settings_button'),
        )
        await expect(freshPopup.getByTestId('settings_screen')).toBeVisible({
            timeout: 20_000,
        })
        await clickThroughPinPrompt(
            freshPopup,
            freshPopup.getByTestId('settings_item_connections'),
        )
        await expect(
            freshPopup.getByTestId('connections_settings_screen'),
        ).toBeVisible({ timeout: 20_000 })

        // toUnifiedWalletConnectConnection builds id as
        // `walletconnect-${clientId}` (connectionsSettingsHelpers.ts) — the
        // clientId is generated by offscreen, not known to this test, so
        // match the testID by its `connection_row_walletconnect-` prefix
        // instead of a literal id.
        const sessionRow = freshPopup.locator(
            '[data-testid^="connection_row_walletconnect-"]',
        )
        await expect(sessionRow).toBeVisible({ timeout: 20_000 })
        await expect(sessionRow).toContainText('Fake E2E DApp')

        expect(freshErrors, 'popup threw an uncaught error').toEqual([])

        // The next test closes every page (including this one) before it
        // runs, so `page` is not read again after this assignment — kept
        // only so `page` reflects the current live surface if this file is
        // ever re-sliced to add more tests after this one.
        page = freshPopup
    })

    // With the session from the previous test still alive purely in
    // offscreen (every extension page was just closed and reopened fresh —
    // `page` above IS that fresh popup, with no pending approval), the dApp
    // peer publishes a real algo_signTxn call. Nothing extension-side is
    // open to receive it except the offscreen document's live bridge
    // socket, so this is the proof that offscreen — not any UI surface —
    // received the request and asked the SW to open an approval surface.
    test('a sign request with no surface open opens the approval window', async () => {
        for (const openPage of context.pages()) {
            await openPage.close()
        }
        // The premise this test depends on: no extension surface is open,
        // so chrome.action.openPopup() has nothing to attach to (see the
        // mechanism note below) and the SW must fall back to
        // chrome.windows.create. Assert it instead of assuming it.
        expect(context.pages()).toHaveLength(0)

        // A real, valid unsigned ARC-0001 transaction (self-payment of 0
        // microAlgos) so the wallet's decoder
        // (readWalletTransactions -> decodeUnsignedTransaction) has
        // something genuine to decode, exactly like dapp-sign.spec.ts's
        // buildUnsignedPaymentTxn.
        const genesisHash = getNetworkConfig(Networks.mainnet).genesisHash
        const suggestedParams = {
            fee: 1000n,
            minFee: 1000n,
            firstValid: 1000n,
            lastValid: 2000n,
            genesisID: 'mainnet-v1.0',
            genesisHash: new Uint8Array(Buffer.from(genesisHash, 'base64')),
            flatFee: true,
        }
        const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: approvedAddress,
            receiver: approvedAddress,
            amount: 0,
            suggestedParams,
        })
        const txnBase64 = Buffer.from(
            algosdk.encodeUnsignedTransaction(txn),
        ).toString('base64')

        // Attach the listener BEFORE triggering the request. ApprovalWindowBridge
        // (approval-bridge.ts) always tries chrome.action.openPopup() first
        // and only falls back to chrome.windows.create('approval.html?...')
        // in a plain try/catch — it does not itself check for a user
        // gesture or an open window. The real variable is Chrome's own
        // behavior: with every extension page just closed above, openPopup()
        // has no window to attach to and rejects, so the fallback runs —
        // unlike the toolbar popup, Playwright CAN observe the resulting
        // window as a new page. Match on the query string too, not just the
        // path, so an unrelated page (there should be none — see the
        // assertion above) can't satisfy this and mask a real failure.
        const newPagePromise = context.waitForEvent('page', {
            predicate: candidate =>
                candidate.url().includes('approval.html?requestId='),
            timeout: 20_000,
        })

        dappConnector
            .sendCustomRequest({
                method: 'algo_signTxn',
                params: [[{ txn: txnBase64, signers: [approvedAddress] }]],
            })
            .catch(() => {
                // Deliberately never resolved by this test: completing the
                // real slide-to-confirm gesture can't be done with
                // Playwright's synthetic pointer in a programmatically
                // opened tab (see dapp-sign.spec.ts's identical note) — this
                // test's assertion is that the approval window opened at
                // all, not that signing completes end to end.
            })

        const approvalPage = await newPagePromise
        await approvalPage.waitForLoadState('domcontentloaded')
        const approvalErrors = trackPageErrors(approvalPage)
        expect(approvalPage.url()).toContain('approval.html')

        // wc-sign routes to the same SignRequestApprovalScreen as ARC-0027
        // sign-transactions/sign-message (DappRequestRoutes.web.tsx), which
        // mounts SignRequestView once the payload decodes and enqueues —
        // wait on that testID rather than a fixed delay.
        await expect(approvalPage.getByTestId('sign-request-view')).toBeVisible(
            { timeout: 20_000 },
        )

        expect(
            approvalErrors,
            'approval window threw an uncaught error',
        ).toEqual([])
        await approvalPage.close()
    })

    // Deterministic reproduction of the CI flake this file used to carry: the
    // offscreen document legitimately dies and gets recreated (a db-worker
    // death makes runOffscreenApp window.close() it), and the recreated
    // document registers its WC control listener only late in an async boot —
    // after DB migrations. A pair control message sent into that window used
    // to fail fast ("WalletConnect failed" toast ~1s after submit) while the
    // DB channel's own retry loop kept every screen looking healthy.
    // sendWcControlMessage now retries within a bounded budget; this closes
    // the document at the worst possible moment (between fill and submit) and
    // proves the pairing still lands.
    test('pairing sent while the offscreen document is recreating still lands', async () => {
        for (const openPage of context.pages()) {
            await openPage.close()
        }

        const pairingPage = await context.newPage()
        const pairingErrors = trackPageErrors(pairingPage)
        await pairingPage.goto(
            `chrome-extension://${extensionId}/expanded.html`,
        )
        const unlockInput = pairingPage.getByTestId('unlock-password-input')
        if (await unlockInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await unlockInput.fill(PASSWORD)
            await pairingPage.getByTestId('unlock-submit').click()
        }
        await expect(pairingPage.getByTestId('account_screen')).toBeVisible({
            timeout: 20_000,
        })

        await dismissPinPromptIfPresent(pairingPage)
        await clickThroughPinPrompt(
            pairingPage,
            pairingPage.getByTestId('tab_menu_button'),
        )
        await expect(pairingPage.getByTestId('menu_screen')).toBeVisible({
            timeout: 20_000,
        })
        await clickThroughPinPrompt(
            pairingPage,
            pairingPage.getByTestId('menu_settings_button'),
        )
        await expect(pairingPage.getByTestId('settings_screen')).toBeVisible({
            timeout: 20_000,
        })
        await clickThroughPinPrompt(
            pairingPage,
            pairingPage.getByTestId('settings_item_connections'),
        )
        await expect(
            pairingPage.getByTestId('connections_settings_screen'),
        ).toBeVisible({ timeout: 20_000 })

        // A second dApp-side pairing over the same fake bridge. The previous
        // connector's approved session lives on wallet-side (revived on the
        // offscreen reboot below); only its socket is retired here so
        // afterAll's single transportClose stays sufficient.
        dappConnector.transportClose()
        dappConnector = new WalletConnect({
            bridge: bridge.url,
            clientMeta: {
                name: 'Fake E2E DApp Reboot',
                description: 'offscreen-recreation e2e fixture',
                url: 'https://fake-e2e-dapp-reboot.test',
                icons: [],
            },
        })
        await dappConnector.createSession({ chainId: 4160 })
        const uri = dappConnector.uri

        // The list is non-empty by now (the first test's session is
        // persisted), so the scanner opens from the header's camera icon —
        // the empty state's connect button is gone with the empty state.
        await clickThroughPinPrompt(
            pairingPage,
            pairingPage.getByTestId('connections_settings_scan_button'),
        )
        await expect(pairingPage.getByTestId('qr-scanner-sheet')).toBeVisible({
            timeout: 20_000,
        })
        await fillPasteInput(pairingPage, uri)

        // Kill the offscreen document AFTER the fill so nothing on this page
        // has time to trigger its recreation before the submit: the pair
        // control message must be the send that lands in the recreate+boot
        // window. closeDocument is the same terminal state as the db-worker
        // death path, minus the crash.
        let [serviceWorker] = context.serviceWorkers()
        if (!serviceWorker) {
            serviceWorker = await context.waitForEvent('serviceworker')
        }
        await serviceWorker.evaluate(() =>
            (
                globalThis as unknown as {
                    chrome: {
                        offscreen: { closeDocument: () => Promise<void> }
                    }
                }
            ).chrome.offscreen.closeDocument(),
        )

        await clickThroughPinPrompt(
            pairingPage,
            pairingPage.getByTestId('qr-paste-submit'),
        )

        // openApprovalSurface polls through `page` — point it at the live
        // surface first. Reaching the approval at all proves the pair
        // bridged the recreated document's boot.
        page = pairingPage
        const { approvalPage, approvalErrors } = await openWcApproval()

        const approvalUnlock = approvalPage.getByTestId('unlock-password-input')
        if (
            await approvalUnlock.isVisible({ timeout: 5000 }).catch(() => false)
        ) {
            await approvalUnlock.fill(PASSWORD)
            await approvalPage.getByTestId('unlock-submit').click()
        }
        await expect(
            approvalPage.getByTestId('wc-connect-peer-name'),
        ).toBeVisible({ timeout: 20_000 })
        const connectButton = approvalPage.getByTestId('wc-connect-connect')
        const alreadySelected =
            (await connectButton.getAttribute('aria-disabled')) !== 'true'
        if (!alreadySelected) {
            await expect(
                approvalPage.getByRole('checkbox').first(),
            ).toBeVisible({ timeout: 20_000 })
            await approvalPage.getByRole('checkbox').first().click()
        }
        await expect(connectButton).not.toHaveAttribute('aria-disabled', 'true')

        const connected = waitForConnectorConnect(dappConnector)
        await connectButton.click()
        const { accounts } = await connected
        expect(accounts.length).toBeGreaterThan(0)

        await approvalPage.close()
        expect(
            approvalErrors,
            'approval popup threw an uncaught error',
        ).toEqual([])
        expect(pairingErrors, 'page threw an uncaught error').toEqual([])
    })
})
