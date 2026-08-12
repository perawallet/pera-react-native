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

// End-to-end proof of the injected ARC-0027 dapp provider: a plain http(s)
// page speaks the real postMessage wire through the full round-trip — page ->
// MAIN-world content script -> isolated relay -> service worker router ->
// approval popup -> back down the same chain.
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
import { getNetworkConfig, Networks } from '@perawallet/wallet-core-config'
import { clickThroughPinPrompt, settlePinPrompt } from './pin-prompt'

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
// Lets the silent re-enable assert it gets back the SAME account.
let grantedAddress: string
const PASSWORD = 'e2e-dapp-connect-password-1'

// The approval handler calls window.close(), so the popup can vanish mid-click
// and surface "Target page... has been closed". That means the click LANDED,
// so swallow it — every caller then asserts the effect on the dapp page.
const clickAcceptingPopupClose = async (locator: Locator): Promise<void> => {
    try {
        await locator.click()
    } catch (error) {
        if (!/has been closed/i.test(String(error))) {
            throw error
        }
    }
}

// Without this, module-eval crashes in the bundle surface as bare selector
// timeouts with no sign of the real cause.
const trackPageErrors = (targetPage: Page): Error[] => {
    const errors: Error[] = []
    targetPage.on('pageerror', error => errors.push(error))
    return errors
}

// Playwright can neither click the toolbar icon nor see its popup as a 'page',
// so open popup.html directly — the same surface and getCurrentApproval()
// discovery path the real popup uses. Waiting for the SW to register the
// pending approval first mirrors real Chrome and guarantees the popup
// discovers it instead of falling through to the wallet home.
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
    // The real toolbar popup's dimensions, so the tab is a faithful proxy.
    await approvalPage.setViewportSize({ width: 360, height: 600 })
    const approvalErrors = trackPageErrors(approvalPage)
    await approvalPage.goto(`chrome-extension://${extensionId}/popup.html`)
    await approvalPage.waitForLoadState('domcontentloaded')
    return { approvalPage, approvalErrors }
}

test.beforeAll(async () => {
    // Must be http(s): content scripts declare
    // `matches: ['http://*/*', 'https://*/*']` and never match `file://`, where
    // a missing provider looks identical to a real bug.
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
    // http:// is only a secure context on 127.0.0.1/localhost — a LAN origin
    // would not get crypto.randomUUID etc.
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

    // An account must exist for the enable-approval screen to grant.
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

    // Settle the security nudge before any sheet-opening test runs: while it
    // is pending it holds every new bottom-sheet presentation.
    await settlePinPrompt(page)

    dappPage = await context.newPage()
    dappPageErrors = trackPageErrors(dappPage)
    await dappPage.goto(dappOrigin)
    // Defined synchronously by the fixture's inline <script>, so a timeout
    // here means the fixture failed to load, not the extension.
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
    // Must be a data URI — a chrome-extension:// URL isn't web-accessible.
    expect(result.icon).toMatch(/^data:image\//)

    // discover never opens an approval window — only enable does.
    expect(context.pages().length).toBe(pagesBefore)
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])
})

test('enable opens the approval popup; approving one account returns it', async () => {
    const { approvalPage, approvalErrors } = await openEnableApprovalPopup()

    expect(approvalPage.url()).toContain('popup.html')

    // VaultGate is outermost, so it wraps the approval surface too.
    const unlockInput = approvalPage.getByTestId('unlock-password-input')
    if (await unlockInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await unlockInput.fill(PASSWORD)
        await approvalPage.getByTestId('unlock-submit').click()
    }

    // The account list may flash empty before hydrating, so assert the real
    // content with a generous timeout rather than assuming an instant render.
    await expect(approvalPage.getByTestId('dapp-enable-origin')).toBeVisible({
        timeout: 20_000,
    })
    await expect(approvalPage.getByTestId('dapp-enable-origin')).toHaveText(
        dappOrigin,
    )

    const connectButton = approvalPage.getByTestId('dapp-enable-connect')
    await expect(connectButton).toBeVisible()

    // The default selection is seeded only if the account store had hydrated
    // in time, so don't assume either branch.
    const alreadySelected =
        (await connectButton.getAttribute('aria-disabled')) !== 'true'
    if (!alreadySelected) {
        await expect(approvalPage.getByRole('checkbox').first()).toBeVisible({
            timeout: 20_000,
        })
        await approvalPage.getByRole('checkbox').first().click()
    }
    await expect(connectButton).not.toHaveAttribute('aria-disabled', 'true')

    await clickAcceptingPopupClose(connectButton)

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

    // A Playwright-opened tab ignores approve()'s window.close(), so close it
    // explicitly to emulate the popup's terminal teardown.
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
    await clickThroughPinPrompt(page, page.getByTestId('tab_menu_button'))
    await expect(page.getByTestId('menu_screen')).toBeVisible({
        timeout: 20_000,
    })
    await clickThroughPinPrompt(page, page.getByTestId('menu_settings_button'))
    await expect(page.getByTestId('settings_screen')).toBeVisible({
        timeout: 20_000,
    })

    // The unified Connections screen supersedes the old Connected Sites entry.
    await clickThroughPinPrompt(
        page,
        page.getByTestId('settings_item_connections'),
    )
    await expect(page.getByTestId('connections_settings_screen')).toBeVisible({
        timeout: 20_000,
    })

    const row = page.getByTestId(`connection_row_dapp-${dappOrigin}`)
    await expect(row).toBeVisible({ timeout: 20_000 })
    await expect(row).toContainText(dappOrigin)

    await clickThroughPinPrompt(
        page,
        page.getByTestId(`connection_revoke_dapp-${dappOrigin}`),
    )
    await expect(
        page.getByTestId('connections_settings_revoke_confirm_bottom_sheet'),
    ).toBeVisible({ timeout: 10_000 })
    await clickThroughPinPrompt(
        page,
        page.getByTestId('connections_settings_revoke_confirm_button'),
    )

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
    await clickAcceptingPopupClose(connectButton)

    await expect
        .poll(() => dappPage.locator('#enable-accounts').textContent(), {
            timeout: 20_000,
        })
        .not.toBe('')
    expect(await dappPage.locator('#enable-error').textContent()).toBe('')
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])
})
