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

// The first half is networkless: a real WC v1 pairing needs a live bridge, so
// every assertion targets a networkless terminal state. The bridge-backed
// session tests at the bottom spin up a local fake bridge.
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
// `qr-paste-input` is a CONTROLLED PWInput and `submitPasted` reads React state,
// so submitting before React commits `fill()`'s change event is a SILENT no-op.
// Asserting the value once reads the DOM, which `fill()` already set; re-checking
// across a frame boundary is what proves React holds it. Never `fill()` this input directly.
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
// screen offers the self-declaration sheet; call this at every gated entry point
// since slice order isn't guaranteed. Discover is gated, WC settings is not.
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

// A valid-but-unreachable URI is dispatched, then fails via connect()'s timeout
// or the connector's 'error' event; both route to onRestart, so the scanner
// staying open is the deterministic terminal state. A toast may or may not appear.
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

    // Wait for the re-arm, NOT a fixed window: the dispatch only fails once the
    // pairing-outcome wait gives up (CONNECTION_OUTCOME_TIMEOUT_MS), and a pairing
    // still in flight keeps QRScannerContent.web's `handlingRef` latched and, on
    // landing, `onRestart()` remounts the content under a later test's fill. The
    // re-arm clears the paste field, so an empty input proves the dispatch is done.
    await expect(page.getByTestId('qr-paste-input')).toHaveValue('', {
        timeout: 20_000,
    })

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

// SKIPPED with the Discover tab, which is not registered on web while Discover's
// feature-gate map lacks a 'web' key (see capabilities.web.ts). Runs on its OWN
// page: visiting Discover on the page that later opens the WC scanner
// intermittently surfaces an unrelated price-fetch rejection as a pageerror. The
// real assertion is gated on discover-main.ts having installed `peraMobileInterface`,
// the same script body that installs the window.open('wc:...') hook this drives.
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

    // The approval sheet has no testID, so its unique header copy stands in
    // for "no approval sheet appeared".
    await expect(
        discoverPage.getByText('SELECT ACCOUNTS', { exact: true }),
    ).not.toBeVisible()
    expect(discoverPageErrors, 'page threw an uncaught error').toEqual([])
    await discoverPage.close()
})

// A real paired session and a real inbound sign request need a real WC v1
// bridge, so this block spins up a local one (fixtures/fake-wc-bridge.mjs:
// pub/sub over topics with offline queueing, like the real Pera bridge) and
// drives the dApp side with the real `@perawallet/walletconnect` client, which
// needs no browser globals on Node >= 22 and so runs in this Playwright process.
test.describe('offscreen ownership of a real WC v1 session (Task 11)', () => {
    let bridge: Awaited<ReturnType<typeof startFakeBridge>>
    let dappConnector: WalletConnect
    let approvedAddress: string

    const openWcApproval = () =>
        openApprovalSurface({ context, page, extensionId })

    // The dApp-side connector's own proof that approveSession reached it over the
    // bridge: resolves with the granted accounts off the real WC v1 `connect` event.
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
        // No `uri` option: passing `bridge` alone makes this the DAPP/INITIATOR
        // side of the same class the wallet side uses.
        dappConnector = new WalletConnect({
            bridge: bridge.url,
            clientMeta: {
                name: 'Fake E2E DApp',
                description: 'Task 11 e2e fixture',
                url: 'https://fake-e2e-dapp.test',
                icons: [],
            },
        })
        // Wildcard chainId (4160, AlgorandChainId.all) so pairing doesn't depend
        // on which network the extension is running against.
        await dappConnector.createSession({ chainId: 4160 })
        const uri = dappConnector.uri

        // The networkless tests leave the scanner open with QRScannerContent.web's
        // `handlingRef` possibly still latched (it clears only when that deep-link
        // path settles), and a fill+submit into a latched instance is silently
        // swallowed. Close the sheet (the backdrop press unmounts the content once
        // the close animation finishes) and reopen it fresh.
        const scannerSheet = page.getByTestId('qr-scanner-sheet')
        // Retry the press until the sheet unmounts: a click can land mid
        // enter-animation, and a miss leaves the scanner open so the reopen never fires.
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

        // The real product path: paste the URI as a user would rather than
        // sending a `pera-connections-control` pair message directly.
        await fillPasteInput(page, uri)
        await clickThroughPinPrompt(page, page.getByTestId('qr-paste-submit'))

        // Offscreen constructs the wallet-side connector and, once the fake bridge
        // flushes the queued wc_sessionRequest, asks the SW for approval, which
        // registers the pending approval this waits for. Either surface is a pass:
        // what matters is that the session survives the popup closing, not which
        // surface Chrome gave us.
        const { approvalPage, approvalErrors } = await openWcApproval()
        expectApprovalSurfaceUrl(approvalPage)

        const unlockInput = approvalPage.getByTestId('unlock-password-input')
        if (await unlockInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await unlockInput.fill(PASSWORD)
            await approvalPage.getByTestId('unlock-submit').click()
        }

        // A proposal renders WcConnectScreen, not the ARC-0027 EnableRequestScreen.
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

        // Close EVERY extension page, then reopen popup.html fresh. The record is
        // only persisted after approveSession resolves against a live offscreen
        // socket, so the row still listed proves offscreen wrote it and the write
        // survived a fresh hydration. Socket *liveness* is what the next test proves.
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

        // toUnifiedConnection ids a WalletConnect row `connection-${clientId}`; the
        // clientId is generated offscreen, so match the prefix. Dapp rows are
        // `dapp-${origin}`, so no collision.
        const sessionRow = freshPopup.locator(
            '[data-testid^="connection_row_connection-"]',
        )
        await expect(sessionRow).toBeVisible({ timeout: 20_000 })
        await expect(sessionRow).toContainText('Fake E2E DApp')

        expect(freshErrors, 'popup threw an uncaught error').toEqual([])

        // Kept so `page` reflects the live surface if more tests are ever added after this one.
        page = freshPopup
    })

    // With the session alive purely in offscreen (every page was just closed and
    // reopened), the dApp peer publishes a real algo_signTxn. Only the offscreen
    // socket can receive it, so this proves offscreen, not a UI surface, asked
    // the SW for an approval.
    test('a sign request with no surface open opens the approval window', async () => {
        for (const openPage of context.pages()) {
            await openPage.close()
        }
        // Premise: no extension surface is open, so openPopup() has nothing to
        // attach to and the SW must fall back to windows.create. Assert it.
        expect(context.pages()).toHaveLength(0)

        // A real unsigned ARC-0001 transaction (0-microAlgo self-payment) so the
        // wallet's decoder has something genuine to decode.
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

        // Attach the listener BEFORE triggering the request. With every extension
        // page closed, openPopup() has nothing to attach to and rejects, so the
        // bridge falls back to windows.create('approval.html?...'), which Playwright
        // CAN observe as a new page. Match the query string too so an unrelated
        // page can't mask a failure.
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
                // Deliberately never resolved: the slide-to-confirm gesture can't be
                // done with Playwright's synthetic pointer in a programmatically
                // opened tab. The assertion is that the window opened, not that signing completes.
            })

        const approvalPage = await newPagePromise
        await approvalPage.waitForLoadState('domcontentloaded')
        const approvalErrors = trackPageErrors(approvalPage)
        expect(approvalPage.url()).toContain('approval.html')

        // Routes to the same SignRequestApprovalScreen as ARC-0027 signing, which
        // mounts SignRequestView once the payload decodes; wait on that testID.
        await expect(approvalPage.getByTestId('sign-request-view')).toBeVisible(
            { timeout: 20_000 },
        )

        expect(
            approvalErrors,
            'approval window threw an uncaught error',
        ).toEqual([])
        await approvalPage.close()
    })

    // The offscreen document legitimately dies and is recreated (a db-worker
    // death closes it), and the recreated document registers its control listener
    // only late in an async boot, after DB migrations. sendConnectionsControlMessage
    // must retry through that window: this closes the document at the worst
    // moment (between fill and submit) and proves the pairing still lands.
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

        // A second dApp-side pairing over the same fake bridge; only the previous
        // connector's socket is retired so afterAll's single transportClose suffices.
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

        // The list is non-empty by now, so the scanner opens from the header's
        // camera icon rather than the empty state's button.
        await clickThroughPinPrompt(
            pairingPage,
            pairingPage.getByTestId('connections_settings_scan_button'),
        )
        await expect(pairingPage.getByTestId('qr-scanner-sheet')).toBeVisible({
            timeout: 20_000,
        })
        await fillPasteInput(pairingPage, uri)

        // Kill the offscreen document AFTER the fill so nothing recreates it before
        // the submit: the pair control message must be the send that lands in the
        // recreate+boot window. closeDocument is the db-worker death path minus the crash.
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

        // openApprovalSurface polls through `page`, so point it at the live surface
        // first. Reaching the approval at all proves the pair bridged the reboot.
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
