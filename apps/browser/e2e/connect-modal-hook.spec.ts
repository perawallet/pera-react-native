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

// The end-to-end proof of the connect-modal-hook feature: a page
// that renders its OWN @perawallet/connect QR modal (with no extension
// transport of its own) still gets an injected "Connect With Pera Extension"
// row, and clicking it carries a REAL WalletConnect v1 handshake from the
// dApp's own client, through the content-script bridge, to the service
// worker, to the offscreen WC host, to the approval surface, and back.
//
// Reuses fixtures/fake-wc-bridge.mjs (see walletconnect.spec.ts's "offscreen
// ownership of a real WC v1 session" block) rather than a second hand-rolled
// bridge, and the real `@perawallet/walletconnect` client as the dApp peer so
// the handshake and payload encryption are genuine.
//
// Selectors are read from the current source, not guessed:
// - CONNECT_MODAL_WRAPPER_ID = 'pera-wallet-connect-modal-wrapper'
//   (apps/browser/src/content/connect-modal-uri.ts:19)
// - INJECTED_ROW_ID = 'pera-extension-injected-row'
//   (apps/browser/src/content/connect-modal-row.ts:24)
// - LAUNCH_BUTTON_ID = 'pera-extension-injected-launch-button' — the button
//   inside the item's expanded panel, which is what actually pairs
//   (apps/browser/src/content/connect-modal-row.ts)
// - The accordion container class the row is injected into:
//   '.pera-wallet-connect-modal-desktop-mode__default-view'
//   (apps/browser/src/content/connect-modal-row.ts:33)
// - Approval screen testIDs (WcConnectScreen, the web twin of mobile's
//   ConnectionView): 'wc-connect-peer-name', 'wc-connect-connect',
//   'wc-connect-cancel' and the requester-origin line
//   'wc-connect-requester-origin' + its verified marker
//   'wc-connect-requester-verified-badge'
//   (apps/mobile/src/modules/dapp/screens/WcConnectScreen/WcConnectHeader.tsx)
// - Requester copy: 'Request came from {{origin}}' / 'Verified tab'
//   (apps/mobile/src/i18n/locales/en.json, dapp.enable.request_origin /
//   dapp.enable.requester_verified_label). The peer's own claim is now its
//   asserted NAME in mobile's headline ('{{name}} wants to connect to your
//   account', walletconnect.request.title) with its asserted url beneath.
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
// account creation, per freshly-mounted surface — every e2e run uses a fresh
// profile, so which surface it lands on is non-deterministic. Copied from
// walletconnect.spec.ts's dismissPinPromptIfPresent (this suite's
// convention: per-file copies, not a shared import).
const dismissPinPromptIfPresent = async (targetPage: Page): Promise<void> => {
    const notNow = targetPage.getByTestId('pin_security_prompt_not_now_button')
    if (await notNow.isVisible().catch(() => false)) {
        await notNow.click()
    }
}

// The pin-security-prompt sheet can land as a full-screen backdrop between a
// visibility wait and the click that follows, intercepting clicks anywhere on
// the page — copied from walletconnect.spec.ts's clickThroughPinPrompt, which
// guards the same race for wc-connect-connect/-cancel elsewhere in this
// suite family.
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

// Serves the SAME fixture markup on a fresh loopback host — content scripts
// only match http(s), never file:// (manifest.json's `matches`), and Chrome
// only grants the secure-context exception (crypto.randomUUID etc, used by
// inject-main.ts) to 'localhost' and '127.0.0.1' specifically — both used
// here as two genuinely different origins.
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

// Pierces the modal's two OPEN shadow roots from page context —
// Element.attachShadow with `mode: 'open'` (as the fixture uses) is required
// for `shadowRoot` to be non-null at all; a closed root would silently make
// every check below false without ever exercising the watcher. The row lives
// two shadow roots deep: <pera-wallet-connect-modal> (shadow root #1) >
// <pera-wallet-modal-desktop-mode> (shadow root #2) — see
// connect-modal-row.ts's module comment for why.
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

// Clicks the launch button inside the injected item's expanded panel — NOT the
// item itself. A header click belongs to the SDK's own accordion handler and
// deliberately does not pair (see connect-modal-row.ts's buildRowMarkup).
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

// Asks the SW (from a trusted extension-page context) whether there is a
// pending approval right now — null when there is none. Same
// 'pera-dapp-approval' scope/kind as get-current-approval elsewhere in this
// suite (see walletconnect.spec.ts's openWcApprovalPopup).
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

// get-current-approval only ever reports a `surface: 'popup'` entry (see its
// own doc comment above), so on its own it cannot prove nothing paired: a
// pair that routed to the approval.html WINDOW instead — which happens
// whenever the toolbar-popup attempt rejects, including when this suite's
// own newly-opened pages (elsewhere in the same `context`) steal focus and
// dismiss the toolbar popup before its first load completes — would also
// read back as null. Checking for an open approval.html page closes that
// gap; together the two checks cover both surfaces.
const hasApprovalWindowOpen = (): boolean =>
    context.pages().some(p => /approval\.html/.test(p.url()))

// Mirrors walletconnect.spec.ts's openWcApprovalPopup, but races two outcomes
// instead of trusting a single poll of get-current-approval: the SW may
// route this request to the toolbar popup OR the approval.html fallback
// window, and which one wins isn't knowable in advance — chrome.action.
// openPopup() resolves only once the toolbar popup has completed its first
// load, and rejects if the popup is dismissed before that happens. In this
// suite that rejection is routine: other pages this suite opens in the same
// `context` (e.g. the fallback-window candidates awaited below, or a fresh
// tab reaching for popup.html) steal focus from the just-opened toolbar
// popup mid-load, which Chrome treats as dismissing it.
//
// Before ApprovalWindowBridge.openViaPopupOrWindow (extensions/
// platform-chrome/src/dapp/approval-bridge.ts) was fixed, `surface` was
// marked 'popup' optimistically, BEFORE tryOpenActionPopup's promise had
// settled, so a single truthy poll wasn't proof the popup surface
// would still be current a moment later — racing this suite a few dozen
// times reproduced exactly that: the poll caught the transient 'popup'
// marking, but by the time a fresh tab reached popup.html the entry had
// already flipped to 'window' and a real approval.html window had opened
// instead, which popup.html has no way to discover (get-current-approval
// only reports the 'popup'-surfaced entry). That's now fixed in production
// — `surface` only ever becomes 'popup' once the popup has genuinely
// opened, and stays stable until the approval settles — but which surface
// wins is still not knowable ahead of time, so this still races: the real
// fallback window appearing (Playwright CAN observe that, unlike the
// toolbar popup — see walletconnect.spec.ts's "sign request with no surface
// open" test), or the popup surface confirmed stable across two reads
// spaced apart (kept as a defensive check, not a workaround).
//
// MUST be called (to register its listeners) BEFORE the click that triggers
// pairing, not after: the SW registers the pending approval and opens its
// chosen surface within single-digit milliseconds of receiving the pair
// message (confirmed by instrumenting the SW directly while diagnosing this
// suite's flakiness) — comfortably faster than the round trip of an
// `await dappPage.evaluate(...)` click plus a second `await` back into this
// helper. Setting up `context.waitForEvent('page', …)` only after the click
// resolves can miss that page's creation event entirely, since Playwright's
// event waiters only observe events that fire after they are registered.
// Returns a thunk to await the outcome, so callers can register first, then
// click, then await:
//   const awaitApproval = beginWaitingForApproval()
//   await clickInjectedRow(dappPage)
//   const { approvalPage } = await awaitApproval()
const beginWaitingForApproval = (): (() => Promise<{
    approvalPage: Page
    approvalErrors: Error[]
}>) => {
    // A brand-new page's `url()` is still 'about:blank' at the instant the
    // 'page' event fires — `windows.create({ url })` attaches the target
    // before navigation to that url commits — so a predicate checked once
    // at event-time can miss the real fallback window entirely. Loop over
    // every new page instead, waiting for EACH candidate's own navigation
    // before deciding it doesn't match.
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

    // Both promises above start running immediately (eagerly), but the
    // `.then(...)` calls that actually observe them only run once the thunk
    // below is invoked. If a caller never awaits the thunk at all — e.g. the
    // test throws between calling beginWaitingForApproval() and clicking —
    // neither promise would otherwise have any consumer, so a later
    // rejection (windowPagePromise's 20s timeout throw, most likely) would
    // surface as a stray unhandled rejection instead of the test's own
    // (already-failing) error. This no-op catch exists purely as that
    // consumer; it does not affect the real handling below, since multiple
    // `.then`/`.catch` calls on the same promise are independent.
    windowPagePromise.catch(() => {})
    popupConfirmed.catch(() => {})

    return async () => {
        const outcome = await Promise.race([
            windowPagePromise.then(
                windowPage => ({ kind: 'window' as const, windowPage }),
                () => ({ kind: 'window-timeout' as const }),
            ),
            // Explicit rejection handler (mirroring windowPagePromise's
            // above), not just Promise.race's own internal subscription: a
            // genuine failure here (e.g. getCurrentApproval's evaluate
            // throwing because `page` closed) must fall through to the
            // popup path's own assertions and time out there as a clear
            // test failure, not vanish as a race loser.
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

        // Either the popup surface was confirmed stable, or neither signal
        // fired (outcome.ok === false / 'window-timeout') — fall through to
        // the popup path either way and let its own assertions surface a
        // clear timeout if truly nothing is pending.
        const approvalPage = await context.newPage()
        await approvalPage.setViewportSize({ width: 360, height: 600 })
        const approvalErrors = trackPageErrors(approvalPage)
        await approvalPage.goto(`chrome-extension://${extensionId}/popup.html`)
        await approvalPage.waitForLoadState('domcontentloaded')
        return { approvalPage, approvalErrors }
    }
}

// The dApp-side connector's own proof that approveSession actually reached
// it over the bridge — resolves with the accounts the wallet granted,
// straight off the real WC v1 `connect` event.
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

// Selects an account if none is pre-selected, then asserts Connect is
// enabled — same defensive pattern as walletconnect.spec.ts / dapp-connect.spec.ts,
// since useEnableRequestScreen only pre-selects the active account if the
// account store had already hydrated by mount time.
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

    // The watcher's MutationObserver + its own initial `process()` call race
    // against the fixture's synchronous DOM build — poll rather than assume
    // either wins.
    await expect
        .poll(() => injectedRowExists(dappPage), {
            timeout: 20_000,
        })
        .toBe(true)

    // Nothing pairs merely because the modal (and the row) exist: no
    // approval is pending until the row is actually clicked. Checked on
    // both surfaces — see hasApprovalWindowOpen's doc comment.
    expect(await getCurrentApproval(page)).toBeNull()
    expect(hasApprovalWindowOpen()).toBe(false)

    // Registered BEFORE the click — see beginWaitingForApproval's doc
    // comment on why this ordering matters.
    const awaitApproval = beginWaitingForApproval()
    await clickInjectedRow(dappPage)

    const { approvalPage, approvalErrors } = await awaitApproval()
    // Whichever surface ApprovalWindowBridge chose (the toolbar-popup
    // discovery path or the approval.html fallback window — see
    // beginWaitingForApproval's comment), it must be an extension-owned page.
    expect(approvalPage.url()).toMatch(/^chrome-extension:\/\//)

    const unlockInput = approvalPage.getByTestId('unlock-password-input')
    if (await unlockInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await unlockInput.fill(PASSWORD)
        await approvalPage.getByTestId('unlock-submit').click()
    }

    // The dApp's own self-asserted peerMeta.name, in mobile's own headline.
    // Untrusted: the peer chooses both this and the url shown beneath it, which
    // is exactly why the browser-verified requester below is rendered
    // separately and marked as verified.
    const peerName = approvalPage.getByTestId('wc-connect-peer-name')
    await expect(peerName).toBeVisible({ timeout: 20_000 })
    await expect(peerName).toHaveText(
        'Fake Connect-Modal DApp wants to connect to your account',
    )

    // The browser-verified requester — the fixture page's REAL origin,
    // scheme included — shown distinctly from the line above, plus its
    // verified marker. This is the coverage gap the task brief calls out:
    // proving the rendered output, not just the hook.
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
    // The real proof the handshake crossed the bridge: the dApp-side
    // client's OWN `connect` event, not anything this test asserted about
    // the wallet's internal state.
    const { accounts } = await connected
    expect(accounts.length).toBeGreaterThan(0)

    await approvalPage.close()
    expect(approvalErrors, 'approval popup threw an uncaught error').toEqual([])
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])

    dappConnector.transportClose()
})

// The trust-model assertion: the SW stamps `sender.origin` (browser-provided,
// unforgeable) as `requesterOrigin`, never anything the page itself claims.
// A second, unrelated origin builds the identical fixture-modal shape and
// gets ITS OWN real origin reported back — proving the stamping is genuinely
// per-request, not a fixed/cached value from the first test.
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

    // (a) The row still requires a click — nothing pairs on mere appearance.
    // Checked on both surfaces — see hasApprovalWindowOpen's doc comment.
    expect(await getCurrentApproval(page)).toBeNull()
    expect(hasApprovalWindowOpen()).toBe(false)

    // Registered BEFORE the click — see beginWaitingForApproval's doc
    // comment on why this ordering matters.
    const awaitApproval = beginWaitingForApproval()
    await clickInjectedRow(dappPage)

    // (b) Once clicked, the approval reports THIS origin as the requester —
    // not originA (test 1's requester), and not the dApp's own identical
    // peerMeta.url claim.
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
    // Proves per-request stamping, not a cached value from test 1: this is
    // THIS test's own real origin (originB), not originA reused, and not
    // the dApp's identical peerMeta.url claim (asserted equal to originB
    // above already rules out both — a single text node can't equal two
    // different strings — so no separate `.not.toHaveText(originA)` is
    // needed).
    await expect(requesterLine).toHaveText(`Request came from ${originB}`)

    // Reject — this test's proof is complete once the requester line is
    // verified; no need to complete a second real handshake.
    await clickThroughPinPrompt(
        approvalPage,
        approvalPage.getByTestId('wc-connect-cancel'),
    )
    await approvalPage.close()

    expect(approvalErrors, 'approval popup threw an uncaught error').toEqual([])
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])

    dappConnector.transportClose()
})
