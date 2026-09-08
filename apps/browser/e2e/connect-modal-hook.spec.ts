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

// End-to-end proof of the connect-modal hook: a page rendering its OWN
// @perawallet/connect QR modal gets an injected "Connect With Pera Extension"
// row, and clicking it carries a REAL WC v1 handshake from the dApp's client
// through the content script, service worker, offscreen host and approval
// surface. Uses fixtures/fake-wc-bridge.mjs and the real `@perawallet/walletconnect`
// client as the dApp peer so the handshake and encryption are genuine. Selectors
// come from apps/browser/src/content/connect-modal-*.ts and WcConnectHeader.tsx.
import {
    expect,
    test,
    chromium,
    type BrowserContext,
    type Locator,
    type Page,
} from '@playwright/test'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import WalletConnect from '@perawallet/walletconnect'
import {
    startFakeBridge,
    type FakeWcBridge,
} from './fixtures/fake-wc-bridge.mjs'

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)
const fixtureHtml = readFileSync(
    path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        'fixtures/connect-modal-page.html',
    ),
)

test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let extensionId: string
let page: Page // the onboarded extension tab (expanded.html) — used to poll/open approvals
let pageErrors: Error[]
let bridge: FakeWcBridge
let serverA: http.Server
let serverB: http.Server
let originA: string // 'http://localhost:PORT' — the legitimate requester in test 1
let originB: string // 'http://127.0.0.1:PORT' — a DIFFERENT origin for the trust-model test
const PASSWORD = 'e2e-connect-modal-hook-password-1'

const CONNECT_MODAL_WRAPPER_ID = 'pera-wallet-connect-modal-wrapper'
const INJECTED_ROW_ID = 'pera-extension-injected-row'
const LAUNCH_BUTTON_ID = 'pera-extension-injected-launch-button'

// Module-eval crashes in the extension bundle otherwise surface as bare
// selector timeouts with no indication of the real cause (see onboarding.spec.ts).
const trackPageErrors = (targetPage: Page): Error[] => {
    const errors: Error[] = []
    targetPage.on('pageerror', error => errors.push(error))
    return errors
}

// PromptContainer's one-time security nudge fires on a wall-clock delay from
// account creation per freshly-mounted surface, so which surface it lands on is
// non-deterministic. Per-file copy by suite convention.
const dismissPinPromptIfPresent = async (targetPage: Page): Promise<void> => {
    const notNow = targetPage.getByTestId('pin_security_prompt_not_now_button')
    if (await notNow.isVisible().catch(() => false)) {
        await notNow.click()
    }
}

// The pin-security-prompt sheet can land as a full-screen backdrop between a
// visibility wait and the click that follows, intercepting clicks anywhere.
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
    // Bounded rather than Playwright's unlimited action timeout, so a genuinely
    // stuck locator fails with a clear timeout.
    await locator.click({ timeout: 10_000 })
}

// The SAME fixture markup on a fresh loopback host: content scripts only match
// http(s), never file://, and Chrome grants the secure-context exception
// (crypto.randomUUID) only to 'localhost' and '127.0.0.1', which double as two origins.
const startFixtureServer = (
    host: 'localhost' | '127.0.0.1',
): Promise<{ server: http.Server; origin: string }> =>
    new Promise(resolve => {
        const server = http.createServer((_req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(fixtureHtml)
        })
        server.listen(0, '127.0.0.1', () => {
            const address = server.address()
            const port =
                address !== null && typeof address === 'object'
                    ? address.port
                    : 0
            resolve({ server, origin: `http://${host}:${port}` })
        })
    })

// Pierces the modal's two OPEN shadow roots from page context; a closed root
// would silently make every check below false. The row lives two roots deep:
// <pera-wallet-connect-modal> > <pera-wallet-modal-desktop-mode>.
const injectedRowExists = (dappPage: Page): Promise<boolean> =>
    dappPage.evaluate(
        ({ wrapperId, rowId }) => {
            const wrapper = document.getElementById(wrapperId)
            const modal = wrapper?.querySelector('pera-wallet-connect-modal')
            const desktopMode = modal?.shadowRoot?.querySelector(
                'pera-wallet-modal-desktop-mode',
            )
            return desktopMode?.shadowRoot?.getElementById(rowId) != null
        },
        { wrapperId: CONNECT_MODAL_WRAPPER_ID, rowId: INJECTED_ROW_ID },
    )

// The launch button inside the expanded panel, NOT the item header: a header
// click belongs to the SDK's accordion handler and deliberately does not pair.
const clickInjectedRow = (dappPage: Page): Promise<void> =>
    dappPage.evaluate(
        ({ wrapperId, launchId }) => {
            const wrapper = document.getElementById(wrapperId)
            const modal = wrapper?.querySelector('pera-wallet-connect-modal')
            const desktopMode = modal?.shadowRoot?.querySelector(
                'pera-wallet-modal-desktop-mode',
            )
            const launch = desktopMode?.shadowRoot?.getElementById(launchId)
            if (!(launch instanceof HTMLElement)) {
                throw new Error('injected launch button not found to click')
            }
            launch.click()
        },
        { wrapperId: CONNECT_MODAL_WRAPPER_ID, launchId: LAUNCH_BUTTON_ID },
    )

const buildFixtureModal = (dappPage: Page, uri: string): Promise<void> =>
    dappPage.evaluate(wcUri => {
        ;(
            window as unknown as { showConnectModal: (u: string) => void }
        ).showConnectModal(wcUri)
    }, uri)

// Asks the SW (from a trusted extension-page context) whether an approval is
// pending; null when none.
const getCurrentApproval = (extensionPage: Page): Promise<unknown> =>
    extensionPage.evaluate(
        scope =>
            new Promise<unknown>(resolve => {
                const runtime = (
                    globalThis as unknown as {
                        chrome?: {
                            runtime?: {
                                sendMessage?: (
                                    message: unknown,
                                    callback: (r: unknown) => void,
                                ) => void
                            }
                        }
                    }
                ).chrome?.runtime
                if (!runtime?.sendMessage) {
                    resolve(null)
                    return
                }
                runtime.sendMessage(
                    { scope, kind: 'get-current-approval' },
                    resolve,
                )
            }),
        'pera-dapp-approval',
    )

// get-current-approval only reports a `surface: 'popup'` entry, so alone it
// cannot prove nothing paired: a pair routed to the approval.html WINDOW (which
// happens whenever the popup attempt rejects, e.g. this suite's own pages stealing
// focus) also reads back null. Checking for an open approval.html page closes the gap.
const hasApprovalWindowOpen = (): boolean =>
    context.pages().some(p => /approval\.html/.test(p.url()))

// Races two outcomes rather than trusting one poll of get-current-approval: the
// SW may route to the toolbar popup OR the approval.html window, and which wins
// isn't knowable in advance (openPopup() rejects if the popup is dismissed before
// first load, which other pages this suite opens routinely cause by stealing
// focus). The window appearing is observable by Playwright; the popup surface is
// confirmed stable across two spaced reads. MUST be called BEFORE the click that
// triggers pairing: the SW opens its surface within milliseconds of the pair
// message, and Playwright event waiters only see events fired after registration.
//   const awaitApproval = beginWaitingForApproval()
//   await clickInjectedRow(dappPage)
//   const { approvalPage } = await awaitApproval()
const beginWaitingForApproval = (): (() => Promise<{
    approvalPage: Page
    approvalErrors: Error[]
}>) => {
    // A brand-new page's `url()` is still 'about:blank' when the 'page' event
    // fires (windows.create attaches the target before navigation commits), so
    // wait for EACH candidate's own navigation before deciding it doesn't match.
    const windowPagePromise = (async (): Promise<Page> => {
        const deadline = Date.now() + 20_000
        for (;;) {
            const remaining = deadline - Date.now()
            if (remaining <= 0) throw new Error('no approval window appeared')
            const candidate = await context.waitForEvent('page', {
                timeout: remaining,
            })
            const matched = await candidate
                .waitForURL(/approval\.html\?requestId=/, { timeout: 3000 })
                .then(() => true)
                .catch(() => false)
            if (matched) return candidate
        }
    })()

    const popupConfirmed = (async (): Promise<boolean> => {
        const deadline = Date.now() + 20_000
        while (Date.now() < deadline) {
            const first = await getCurrentApproval(page)
            if (first) {
                await new Promise(resolve => setTimeout(resolve, 300))
                const second = await getCurrentApproval(page)
                if (
                    second &&
                    JSON.stringify(second) === JSON.stringify(first)
                ) {
                    return true
                }
            }
            await new Promise(resolve => setTimeout(resolve, 200))
        }
        return false
    })()

    // The `.then(...)` observers below only attach once the thunk is invoked; if
    // a caller never awaits it (a test throws between registering and clicking)
    // a later rejection would surface as a stray unhandled rejection. This no-op
    // catch is that consumer and does not affect the real handling.
    windowPagePromise.catch(() => {})
    popupConfirmed.catch(() => {})

    return async () => {
        const outcome = await Promise.race([
            windowPagePromise.then(
                windowPage => ({ kind: 'window' as const, windowPage }),
                () => ({ kind: 'window-timeout' as const }),
            ),
            // Explicit rejection handler, not just Promise.race's subscription: a
            // genuine failure here must fall through to the popup path's
            // assertions and time out clearly, not vanish as a race loser.
            popupConfirmed.then(
                ok => ({ kind: 'popup' as const, ok }),
                () => ({ kind: 'popup' as const, ok: false }),
            ),
        ])

        if (outcome.kind === 'window') {
            const approvalErrors = trackPageErrors(outcome.windowPage)
            await outcome.windowPage.waitForLoadState('domcontentloaded')
            return { approvalPage: outcome.windowPage, approvalErrors }
        }

        // Popup confirmed stable, or neither signal fired: fall through to the
        // popup path either way and let its assertions surface a clear timeout.
        const approvalPage = await context.newPage()
        await approvalPage.setViewportSize({ width: 360, height: 600 })
        const approvalErrors = trackPageErrors(approvalPage)
        await approvalPage.goto(`chrome-extension://${extensionId}/popup.html`)
        await approvalPage.waitForLoadState('domcontentloaded')
        return { approvalPage, approvalErrors }
    }
}

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
                    ? accounts.filter((a): a is string => typeof a === 'string')
                    : [],
            })
        })
    })

// Selects an account if none is pre-selected: useEnableRequestScreen only
// pre-selects the active account if the store had hydrated by mount time.
const ensureAccountSelected = async (approvalPage: Page): Promise<void> => {
    const connectButton = approvalPage.getByTestId('wc-connect-connect')
    await expect(connectButton).toBeVisible({ timeout: 20_000 })
    const alreadySelected =
        (await connectButton.getAttribute('aria-disabled')) !== 'true'
    if (!alreadySelected) {
        await expect(approvalPage.getByRole('checkbox').first()).toBeVisible({
            timeout: 20_000,
        })
        await approvalPage.getByRole('checkbox').first().click()
    }
    await expect(connectButton).not.toHaveAttribute('aria-disabled', 'true')
}

test.beforeAll(async () => {
    const [a, b] = await Promise.all([
        startFixtureServer('localhost'),
        startFixtureServer('127.0.0.1'),
    ])
    serverA = a.server
    originA = a.origin
    serverB = b.server
    originB = b.origin

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

    // Onboard exactly as the other e2e suites (wallet-smoke.spec.ts / walletconnect.spec.ts).
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
    await bridge?.close()
    await Promise.all([
        new Promise<void>(resolve => serverA.close(() => resolve())),
        new Promise<void>(resolve => serverB.close(() => resolve())),
    ])
})

test('the injected row pairs a real WC session, and approving it surfaces the verified requester origin and the dapp-side connect event', async () => {
    bridge = await startFakeBridge()
    const dappConnector = new WalletConnect({
        bridge: bridge.url,
        clientMeta: {
            name: 'Fake Connect-Modal DApp',
            description: 'Task 8 e2e fixture',
            url: 'https://fake-connect-modal-dapp.test',
            icons: [],
        },
    })
    // Wildcard chainId (4160, AlgorandChainId.all) accepts pairing regardless
    // of which network the extension is currently running against.
    await dappConnector.createSession({ chainId: 4160 })
    const uri = dappConnector.uri

    const dappPage = await context.newPage()
    const dappPageErrors = trackPageErrors(dappPage)
    await dappPage.goto(originA)
    await dappPage.waitForFunction(
        () =>
            typeof (window as unknown as { showConnectModal?: unknown })
                .showConnectModal === 'function',
    )

    await buildFixtureModal(dappPage, uri)

    // The watcher's MutationObserver and its initial `process()` race the
    // fixture's synchronous DOM build; poll rather than assume either wins.
    await expect
        .poll(() => injectedRowExists(dappPage), {
            timeout: 20_000,
        })
        .toBe(true)

    // Nothing pairs merely because the row exists. Checked on both surfaces
    // (see hasApprovalWindowOpen).
    expect(await getCurrentApproval(page)).toBeNull()
    expect(hasApprovalWindowOpen()).toBe(false)

    // Registered BEFORE the click (see beginWaitingForApproval).
    const awaitApproval = beginWaitingForApproval()
    await clickInjectedRow(dappPage)

    const { approvalPage, approvalErrors } = await awaitApproval()
    // Whichever surface the bridge chose, it must be an extension-owned page.
    expect(approvalPage.url()).toMatch(/^chrome-extension:\/\//)

    const unlockInput = approvalPage.getByTestId('unlock-password-input')
    if (await unlockInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await unlockInput.fill(PASSWORD)
        await approvalPage.getByTestId('unlock-submit').click()
    }

    // The peer's self-asserted name and url are untrusted, which is why the
    // browser-verified requester is rendered separately below.
    const peerName = approvalPage.getByTestId('wc-connect-peer-name')
    await expect(peerName).toBeVisible({ timeout: 20_000 })
    await expect(peerName).toHaveText(
        'Fake Connect-Modal DApp wants to connect to your account',
    )

    // The browser-verified requester: the fixture page's REAL origin, scheme
    // included, plus its verified marker.
    const requesterLine = approvalPage.getByTestId(
        'wc-connect-requester-origin',
    )
    await expect(requesterLine).toBeVisible({ timeout: 20_000 })
    await expect(requesterLine).toHaveText(`Request came from ${originA}`)
    const verifiedBadge = approvalPage.getByTestId(
        'wc-connect-requester-verified-badge',
    )
    await expect(verifiedBadge).toBeVisible()
    await expect(verifiedBadge).toHaveText('Verified tab')

    await ensureAccountSelected(approvalPage)

    const connected = waitForConnectorConnect(dappConnector)
    await clickThroughPinPrompt(
        approvalPage,
        approvalPage.getByTestId('wc-connect-connect'),
    )
    // The real proof the handshake crossed the bridge: the dApp-side client's OWN `connect` event.
    const { accounts } = await connected
    expect(accounts.length).toBeGreaterThan(0)

    await approvalPage.close()
    expect(approvalErrors, 'approval popup threw an uncaught error').toEqual([])
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])

    dappConnector.transportClose()
})

// The trust-model assertion: the SW stamps browser-provided `sender.origin` as
// `requesterOrigin`, never anything the page claims. A second origin building
// the identical fixture gets ITS OWN origin back, proving per-request stamping.
test('a fabricated modal on a different origin is stamped with THAT origin, not the first', async () => {
    const dappConnector = new WalletConnect({
        bridge: bridge.url,
        clientMeta: {
            name: 'Fake Connect-Modal DApp (origin B)',
            description: 'Task 8 e2e fixture — trust-model test',
            url: 'https://fake-connect-modal-dapp.test', // same self-asserted peerMeta.url as test 1 on purpose
            icons: [],
        },
    })
    await dappConnector.createSession({ chainId: 4160 })
    const uri = dappConnector.uri

    const dappPage = await context.newPage()
    const dappPageErrors = trackPageErrors(dappPage)
    await dappPage.goto(originB)
    await dappPage.waitForFunction(
        () =>
            typeof (window as unknown as { showConnectModal?: unknown })
                .showConnectModal === 'function',
    )

    await buildFixtureModal(dappPage, uri)
    await expect
        .poll(() => injectedRowExists(dappPage), {
            timeout: 20_000,
        })
        .toBe(true)

    // (a) Nothing pairs on mere appearance. Checked on both surfaces.
    expect(await getCurrentApproval(page)).toBeNull()
    expect(hasApprovalWindowOpen()).toBe(false)

    // Registered BEFORE the click (see beginWaitingForApproval).
    const awaitApproval = beginWaitingForApproval()
    await clickInjectedRow(dappPage)

    // (b) Once clicked, the approval reports THIS origin as the requester.
    const { approvalPage, approvalErrors } = await awaitApproval()

    const unlockInput = approvalPage.getByTestId('unlock-password-input')
    if (await unlockInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await unlockInput.fill(PASSWORD)
        await approvalPage.getByTestId('unlock-submit').click()
    }

    const requesterLine = approvalPage.getByTestId(
        'wc-connect-requester-origin',
    )
    await expect(requesterLine).toBeVisible({ timeout: 20_000 })
    // originB here rules out both originA and the dApp's identical peerMeta.url
    // claim, so no separate `.not.toHaveText(originA)` is needed.
    await expect(requesterLine).toHaveText(`Request came from ${originB}`)

    // Reject: the proof is complete once the requester line is verified.
    await clickThroughPinPrompt(
        approvalPage,
        approvalPage.getByTestId('wc-connect-cancel'),
    )
    await approvalPage.close()

    expect(approvalErrors, 'approval popup threw an uncaught error').toEqual([])
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])

    dappConnector.transportClose()
})
