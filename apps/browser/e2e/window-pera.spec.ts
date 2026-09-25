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

// End-to-end proof of the `window.pera` bridge: a plain http page drives the
// real chain — MAIN provider -> isolated relay -> service worker -> offscreen
// handler -> approval surface -> back down the same chain — for connect,
// getAddresses, signing and a revoke from Settings.
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
import algosdk from 'algosdk'
import { getNetworkConfig, Networks } from '@perawallet/wallet-core-config'
import { clickThroughPinPrompt, settlePinPrompt } from './pin-prompt'
import {
    expectApprovalSurfaceUrl,
    openApprovalSurface,
    selectAccountAndArmConnect,
    tapToConfirm,
    trackPageErrors,
} from './approval-surface'

declare global {
    interface Window {
        /** The fixture's staging slot for the txn the sign button submits. */
        __txn: string | null
    }
}

const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../dist',
)
const fixtureHtml = readFileSync(
    path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        'fixtures/window-pera-page.html',
    ),
)

test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let extensionId: string
let page: Page // the onboarded extension tab (expanded.html)
let dappPage: Page // the plain http page speaking window.pera
let pageErrors: Error[]
let dappPageErrors: Error[]
let server: http.Server
let dappOrigin: string
// Lets the silent reconnect assert it gets back the SAME account.
let grantedAddress: string
const PASSWORD = 'e2e-window-pera-password-1'

// A 0-microAlgo self-payment, so it needs no funding.
const buildUnsignedPaymentTxn = (
    sender: string,
    genesisHashB64: string,
    genesisId: string,
): string => {
    const suggestedParams = {
        fee: 1000n,
        minFee: 1000n,
        firstValid: 1000n,
        lastValid: 2000n,
        genesisID: genesisId,
        genesisHash: new Uint8Array(Buffer.from(genesisHashB64, 'base64')),
        flatFee: true,
    }
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender,
        receiver: sender,
        amount: 0,
        suggestedParams,
    })
    return Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString(
        'base64',
    )
}

// VaultGate is outermost, so it wraps the approval surface too.
const unlockIfNeeded = async (approvalPage: Page): Promise<void> => {
    const unlockInput = approvalPage.getByTestId('unlock-password-input')
    if (await unlockInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await unlockInput.fill(PASSWORD)
        await approvalPage.getByTestId('unlock-submit').click()
    }
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
    // would be refused by the service worker's origin gate.
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

    // An account must exist for the proposal screen to grant one.
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
    await dappPage.waitForFunction(() => typeof window.pera === 'object')
})

test.afterAll(async () => {
    await context.close()
    await new Promise<void>(resolve => server.close(() => resolve()))
})

test('window.pera is present and versioned before any approval', async () => {
    expect(await dappPage.evaluate(() => window.pera.version)).toBe('1')
    expect(await dappPage.evaluate(() => Object.isFrozen(window.pera))).toBe(
        true,
    )
})

// Driven from the fixture's own load handler, not page.evaluate: Playwright
// evaluates with `userGesture` set, so a connect() issued from the harness
// carries real transient activation and would legitimately be approved.
test('connect() without a user gesture is refused and opens no approval', async () => {
    await expect
        .poll(() => dappPage.locator('#load-connect-error').textContent(), {
            timeout: 20_000,
        })
        .not.toBe('')

    const error = JSON.parse(
        (await dappPage.locator('#load-connect-error').textContent()) ?? '{}',
    ) as { code: number }
    expect(error.code).toBe(-32_001)
    expect(
        context.pages().some(candidate => candidate.url().includes('approval')),
    ).toBe(false)
})

test('a clicked connect opens the proposal naming the verified origin; approving returns the account', async () => {
    await dappPage.getByTestId('connect').click()

    const { approvalPage, approvalErrors } = await openApprovalSurface({
        context,
        page,
        extensionId,
    })
    expectApprovalSurfaceUrl(approvalPage)
    await unlockIfNeeded(approvalPage)

    await expect(
        approvalPage.getByTestId('wc-connect-peer-name'),
    ).toContainText('E2E dApp', { timeout: 20_000 })
    // A dapp connection's peer.url IS the browser-verified origin, so the
    // header shows the verified badge and not the "actually from" line that
    // only appears when a peer asserts a different url.
    await expect(
        approvalPage.getByTestId('wc-connect-requester-verified-badge'),
    ).toBeVisible()
    // Shown without its scheme, and as plain text rather than a link: the e2e
    // dApp is served over http, which fails the header's https-only gate.
    await expect(
        approvalPage.getByTestId('wc-connect-peer-url-text'),
    ).toHaveText(dappOrigin.replace(/^https?:\/\//, ''))

    const connectButton = approvalPage.getByTestId('wc-connect-connect')
    await selectAccountAndArmConnect(approvalPage, connectButton)
    await connectButton.click()

    await expect
        .poll(() => dappPage.locator('#connect-result').textContent(), {
            timeout: 20_000,
        })
        .not.toBe('')
    expect(await dappPage.locator('#connect-error').textContent()).toBe('')

    const result = JSON.parse(
        (await dappPage.locator('#connect-result').textContent()) ?? '{}',
    ) as { accounts: { address: string }[]; network: string }
    expect(result.network).toBe('mainnet')
    expect(result.accounts).toHaveLength(1)
    expect(result.accounts[0].address.length).toBe(58)
    grantedAddress = result.accounts[0].address

    // A Playwright-opened tab ignores approve()'s window.close(), so close it
    // explicitly to emulate the popup's terminal teardown.
    await approvalPage.close()

    expect(approvalErrors, 'approval surface threw an uncaught error').toEqual(
        [],
    )
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])
})

test('a second connect resolves silently with the same account and no window', async () => {
    const pagesBefore = context.pages().length

    const result = await dappPage.evaluate(() => window.pera.connect())

    expect(result.accounts[0].address).toBe(grantedAddress)
    expect(result.accounts).toHaveLength(1)
    expect(context.pages().length).toBe(pagesBefore)
})

test('getAddresses returns the approved account', async () => {
    await dappPage.getByTestId('addresses').click()

    await expect
        .poll(() => dappPage.locator('#addresses-result').textContent(), {
            timeout: 20_000,
        })
        .toContain(grantedAddress)
})

test('signTransactions opens the signing review and returns one signed transaction', async () => {
    const unsignedTxnB64 = buildUnsignedPaymentTxn(
        grantedAddress,
        getNetworkConfig(Networks.mainnet).genesisHash,
        'mainnet-v1.0',
    )
    await dappPage.evaluate(txn => {
        window.__txn = txn
    }, unsignedTxnB64)

    await dappPage.getByTestId('sign').click()

    const { approvalPage, approvalErrors } = await openApprovalSurface({
        context,
        page,
        extensionId,
    })
    await unlockIfNeeded(approvalPage)

    const confirmControl = approvalPage.getByTestId('signing-confirm-slide')
    await expect(confirmControl).toBeVisible({ timeout: 20_000 })
    await tapToConfirm(approvalPage, confirmControl)

    // Poll BOTH outcomes: waiting on the success one alone turns a decline
    // into a bare timeout with the real reason sitting unread in the DOM.
    await expect
        .poll(
            async () =>
                (await dappPage.locator('#sign-result').textContent()) ||
                (await dappPage.locator('#sign-error').textContent()) ||
                '',
            { timeout: 20_000 },
        )
        .not.toBe('')
    expect(
        await dappPage.locator('#sign-error').textContent(),
        'the wallet declined the sign request',
    ).toBe('')

    const signed = JSON.parse(
        (await dappPage.locator('#sign-result').textContent()) ?? '[]',
    ) as (string | null)[]
    expect(signed).toHaveLength(1)
    expect(signed[0]).toBeTruthy()
    // Decodes as a real signed transaction, not an echo of the request.
    expect(
        algosdk.decodeSignedTransaction(
            new Uint8Array(Buffer.from(signed[0] ?? '', 'base64')),
        ).sig,
    ).toBeTruthy()

    await approvalPage.close()
    expect(approvalErrors, 'approval surface threw an uncaught error').toEqual(
        [],
    )
})

test('the connection appears in Settings and revoking it notifies the page', async () => {
    await clickThroughPinPrompt(page, page.getByTestId('tab_menu_button'))
    await expect(page.getByTestId('menu_screen')).toBeVisible({
        timeout: 20_000,
    })
    await clickThroughPinPrompt(page, page.getByTestId('menu_settings_button'))
    await expect(page.getByTestId('settings_screen')).toBeVisible({
        timeout: 20_000,
    })
    await clickThroughPinPrompt(
        page,
        page.getByTestId('settings_item_connections'),
    )
    await expect(page.getByTestId('connections_settings_screen')).toBeVisible({
        timeout: 20_000,
    })

    // The row id is the browser-verified origin — one connection per origin.
    const row = page.getByTestId(`connection_row_connection-${dappOrigin}`)
    await expect(row).toBeVisible({ timeout: 20_000 })

    await clickThroughPinPrompt(
        page,
        page.getByTestId(`connection_revoke_connection-${dappOrigin}`),
    )
    await expect(
        page.getByTestId('connections_settings_revoke_confirm_bottom_sheet'),
    ).toBeVisible({ timeout: 10_000 })
    await clickThroughPinPrompt(
        page,
        page.getByTestId('connections_settings_revoke_confirm_button'),
    )

    await expect(row).toHaveCount(0, { timeout: 10_000 })
    await expect
        .poll(() => dappPage.locator('#events').textContent(), {
            timeout: 20_000,
        })
        .toContain('disconnect;')

    const code = await dappPage.evaluate(() =>
        window.pera.getAddresses().then(
            () => null,
            (error: { code: number }) => error.code,
        ),
    )
    expect(code).toBe(-32_001)
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})
