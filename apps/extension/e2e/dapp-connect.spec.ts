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

// M4a Task 9: the end-to-end proof of the injected ARC-0027 dapp provider.
// A plain http(s) page (the ONLY origin content scripts match — manifest.json
// declares `matches: ['http://*/*', 'https://*/*']`, never `file://`) speaks
// the real ARC-0027 postMessage wire, exercising the full round-trip: page ->
// MAIN-world content script -> isolated-world relay -> service worker router
// -> (fresh enable) approval popup window -> back down the same chain. This
// is the "moment of truth" for the content-script handshake landed in Tasks
// 5 and 7 — if discover times out here, the wiring is genuinely broken in
// real Chrome, not just under test.
import {
    expect,
    test,
    chromium,
    type BrowserContext,
    type Page,
} from '@playwright/test'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getNetworkConfig, Networks } from '@perawallet/wallet-core-config'

declare global {
    interface Window {
        sendArc: (method: string, params?: Record<string, unknown>) => string
    }
}

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)
const fixtureHtml = readFileSync(
    path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        'fixtures/dapp-test-page.html',
    ),
)

test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let extensionId: string
let page: Page // the onboarded extension tab (expanded.html)
let dappPage: Page // the plain http(s) page speaking the ARC-0027 wire
let pageErrors: Error[]
let dappPageErrors: Error[]
let server: http.Server
let dappOrigin: string
// Populated once enable is approved (Assertion 2) so Assertion 3 can confirm
// the silent re-enable returns the SAME account, not just any account.
let grantedAddress: string
const PASSWORD = 'e2e-dapp-connect-password-1'

// Module-eval crashes in the extension bundle otherwise surface as bare
// selector timeouts with no indication of the real cause (see onboarding.spec.ts).
const trackPageErrors = (targetPage: Page): Error[] => {
    const errors: Error[] = []
    targetPage.on('pageerror', error => errors.push(error))
    return errors
}

// PromptContainer (modules/prompts) shows a one-time security nudge on a
// wall-clock delay after the account exists (wallet-smoke.spec.ts carries the
// same note) — dismiss it if it raced in and is covering a click target.
const dismissPinPromptIfPresent = async (targetPage: Page): Promise<void> => {
    const notNow = targetPage.getByTestId('pin_security_prompt_not_now_button')
    if (await notNow.isVisible().catch(() => false)) {
        await notNow.click()
    }
}

// M4c: enable now opens the extension's TOOLBAR POPUP via
// chrome.action.openPopup() instead of a dedicated approval window. Playwright
// can neither click the toolbar icon nor observe that popup as a 'page', so
// drive the approval by opening popup.html directly — the SAME 'popup' surface
// and getCurrentApproval() discovery path the real toolbar popup uses. Wait for
// the SW to register the pending approval first (mirrors real Chrome, where the
// SW calls openPopup only AFTER registering the pending approval), so the popup
// we open is guaranteed to discover it instead of falling through to the wallet
// home. Attaches the pageerror listener BEFORE navigation so module-eval
// crashes on load are caught, not missed.
const openEnableApprovalPopup = async (): Promise<{
    approvalPage: Page
    approvalErrors: Error[]
}> => {
    await dappPage.evaluate(() => {
        window.sendArc('enable')
    })
    await expect
        .poll(
            () =>
                page.evaluate(
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
                ),
            { timeout: 20_000 },
        )
        .not.toBeNull()
    const approvalPage = await context.newPage()
    // Match the real toolbar popup's dimensions (360x600) so the tab is a
    // faithful proxy rather than a full-width window.
    await approvalPage.setViewportSize({ width: 360, height: 600 })
    const approvalErrors = trackPageErrors(approvalPage)
    await approvalPage.goto(`chrome-extension://${extensionId}/popup.html`)
    await approvalPage.waitForLoadState('domcontentloaded')
    return { approvalPage, approvalErrors }
}

test.beforeAll(async () => {
    // The fixture MUST be served over http(s) — content scripts are declared
    // with `matches: ['http://*/*', 'https://*/*']` and never match `file://`,
    // so a page.goto('file://...') would silently get no injected provider at
    // all (a real bug looks identical to "no page.goto over http" here).
    server = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(fixtureHtml)
    })
    await new Promise<void>(resolve => {
        server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    const port =
        address !== null && typeof address === 'object' ? address.port : 0
    // Chrome only treats http:// as a secure context (crypto.randomUUID etc.)
    // for 127.0.0.1/localhost specifically — a plain LAN http:// origin would
    // not get this exception.
    dappOrigin = `http://localhost:${port}`

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

    // Onboard exactly as wallet-smoke.spec.ts: create password -> terms ->
    // create wallet -> name account -> home. An account must exist for the
    // enable-approval screen to have something to grant.
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

    dappPage = await context.newPage()
    dappPageErrors = trackPageErrors(dappPage)
    await dappPage.goto(dappOrigin)
    // window.sendArc is defined synchronously by the fixture's inline
    // <script>; if this ever times out, the fixture itself failed to load,
    // not the extension.
    await dappPage.waitForFunction(() => typeof window.sendArc === 'function')
})

test.afterAll(async () => {
    await context.close()
    await new Promise<void>(resolve => server.close(() => resolve()))
})

test('discover resolves providerId + active-network genesisHash with no approval window', async () => {
    const pagesBefore = context.pages().length
    const expectedGenesisHash = getNetworkConfig(Networks.mainnet).genesisHash

    await dappPage.evaluate(() => {
        window.sendArc('discover')
    })

    await expect
        .poll(() => dappPage.locator('#discover-result').textContent(), {
            timeout: 20_000,
        })
        .not.toBe('')

    const raw = await dappPage.locator('#discover-result').textContent()
    expect(raw, 'discover must not resolve to an error').not.toMatch(/^ERROR/)
    const result = JSON.parse(raw ?? '{}') as {
        providerId: string
        icon: string
        networks: { genesisHash: string; genesisId: string }[]
    }
    expect(result.providerId).toBe('pera-wallet')
    expect(result.networks).toHaveLength(1)
    expect(result.networks[0].genesisHash).toBe(expectedGenesisHash)
    // icon must be a data URI — a chrome-extension:// URL can't be loaded by
    // a normal https dapp page (no web_accessible_resources entry).
    expect(result.icon).toMatch(/^data:image\//)

    // discover never opens an approval window — only enable does.
    expect(context.pages().length).toBe(pagesBefore)
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])
})

test('enable opens the approval popup; approving one account returns it', async () => {
    const { approvalPage, approvalErrors } = await openEnableApprovalPopup()

    expect(approvalPage.url()).toContain('popup.html')

    // Vault-lock gate wraps the approval surface too (VaultGate is outermost)
    // — unlock defensively in case the vault ever re-locks between specs,
    // even though this suite's own onboarding leaves it unlocked.
    const unlockInput = approvalPage.getByTestId('unlock-password-input')
    if (await unlockInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await unlockInput.fill(PASSWORD)
        await approvalPage.getByTestId('unlock-submit').click()
    }

    // Task-6-flagged concern: does the account list hydrate reliably, or does
    // it flash empty first? Assert the real content directly with a generous
    // timeout rather than assuming an instant render.
    await expect(approvalPage.getByTestId('dapp-enable-origin')).toBeVisible({
        timeout: 20_000,
    })
    await expect(approvalPage.getByTestId('dapp-enable-origin')).toHaveText(
        dappOrigin,
    )

    const connectButton = approvalPage.getByTestId('dapp-enable-connect')
    await expect(connectButton).toBeVisible()

    // useEnableRequestScreen seeds the default selection with the active
    // account ONLY if the account store had already hydrated by the time this
    // screen's local `selected` state initializes. Don't assume either
    // branch: only click the checkbox if Connect isn't already enabled.
    const alreadySelected =
        (await connectButton.getAttribute('aria-disabled')) !== 'true'
    if (!alreadySelected) {
        await expect(approvalPage.getByRole('checkbox').first()).toBeVisible({
            timeout: 20_000,
        })
        await approvalPage.getByRole('checkbox').first().click()
    }
    await expect(connectButton).not.toHaveAttribute('aria-disabled', 'true')

    await connectButton.click()

    await expect
        .poll(() => dappPage.locator('#enable-accounts').textContent(), {
            timeout: 20_000,
        })
        .not.toBe('')
    expect(await dappPage.locator('#enable-error').textContent()).toBe('')

    const accounts = JSON.parse(
        (await dappPage.locator('#enable-accounts').textContent()) ?? '[]',
    ) as { address: string }[]
    expect(accounts).toHaveLength(1)
    expect(typeof accounts[0].address).toBe('string')
    // Algorand addresses are 58-char base32.
    expect(accounts[0].address.length).toBe(58)
    grantedAddress = accounts[0].address

    // approve() calls window.close(); the real toolbar popup is terminal, but a
    // Playwright-opened tab won't self-close on script request, so close it
    // explicitly to emulate the popup's terminal teardown and keep page counts
    // clean for later serial tests.
    await approvalPage.close()

    expect(approvalErrors, 'approval popup threw an uncaught error').toEqual([])
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])
})

test('a second enable from the same page resolves silently with no new approval window', async () => {
    const pagesBefore = context.pages().length

    await dappPage.evaluate(() => {
        window.sendArc('enable')
    })

    await expect
        .poll(() => dappPage.locator('#enable-accounts').textContent(), {
            timeout: 20_000,
        })
        .not.toBe('')

    const accounts = JSON.parse(
        (await dappPage.locator('#enable-accounts').textContent()) ?? '[]',
    ) as { address: string }[]
    expect(accounts).toEqual([{ address: grantedAddress }])
    expect(await dappPage.locator('#enable-error').textContent()).toBe('')

    // The permission was already granted — no new approval window this time.
    expect(context.pages().length).toBe(pagesBefore)
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])
})

test('Connections settings lists the localhost origin and can revoke it', async () => {
    await dismissPinPromptIfPresent(page)
    await page.getByTestId('tab_menu_button').click()
    await expect(page.getByTestId('menu_screen')).toBeVisible({
        timeout: 20_000,
    })
    await page.getByTestId('menu_settings_button').click()
    await expect(page.getByTestId('settings_screen')).toBeVisible({
        timeout: 20_000,
    })

    // The unified Connections screen (connectionsSettings capability, web
    // only) supersedes the old standalone Connected Sites menu entry —
    // settings_item_${title...} (SettingsScreen.tsx) on 'Connections'
    // (settings.main.connections_title) → settings_item_connections.
    await page.getByTestId('settings_item_connections').click()
    await expect(page.getByTestId('connections_settings_screen')).toBeVisible({
        timeout: 20_000,
    })

    const row = page.getByTestId(`connection_row_dapp-${dappOrigin}`)
    await expect(row).toBeVisible({ timeout: 20_000 })
    await expect(row).toContainText(dappOrigin)

    await page.getByTestId(`connection_revoke_dapp-${dappOrigin}`).click()
    await expect(
        page.getByTestId('connections_settings_revoke_confirm_bottom_sheet'),
    ).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('connections_settings_revoke_confirm_button').click()

    await expect(row).toHaveCount(0, { timeout: 10_000 })
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

test('enable prompts again after the permission was revoked in Settings', async () => {
    const { approvalPage } = await openEnableApprovalPopup()

    expect(approvalPage.url()).toContain('popup.html')

    await expect(approvalPage.getByTestId('dapp-enable-origin')).toBeVisible({
        timeout: 20_000,
    })
    const connectButton = approvalPage.getByTestId('dapp-enable-connect')
    const alreadySelected =
        (await connectButton.getAttribute('aria-disabled')) !== 'true'
    if (!alreadySelected) {
        await approvalPage.getByRole('checkbox').first().click()
    }
    await connectButton.click()

    await expect
        .poll(() => dappPage.locator('#enable-accounts').textContent(), {
            timeout: 20_000,
        })
        .not.toBe('')
    expect(await dappPage.locator('#enable-error').textContent()).toBe('')
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])
})
