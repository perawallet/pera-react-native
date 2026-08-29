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

// End-to-end proof of ARC-0027 transaction signing on dapp-connect.spec.ts's
// harness: a connected dapp asks `sign_transactions` to sign a REAL unsigned
// payment, the approval window decodes and renders it, and a genuinely-signed
// transaction comes back. Plus the not-connected (4100) and reject (4001)
// paths.
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
import {
    expectApprovalSurfaceUrl,
    openApprovalSurface,
    trackPageErrors,
} from './approval-surface'

declare global {
    interface Window {
        sendArc: (method: string, params?: Record<string, unknown>) => string
        signTxns: (txns: { txn: string }[]) => string
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
let grantedAddress: string
const PASSWORD = 'e2e-dapp-sign-password-1'

const openApprovalPopup = () =>
    openApprovalSurface({ context, page, extensionId })

const openEnableApprovalPopup = async (): Promise<Page> => {
    await dappPage.evaluate(() => {
        window.sendArc('enable')
    })
    const { approvalPage } = await openApprovalPopup()
    return approvalPage
}

// A 0-microAlgo self-payment, so it needs no funding. `genesisHashB64` comes
// from the same discover/enable call the dapp connected with, so it can never
// drift from the extension's active network.
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

test.beforeAll(async () => {
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
    await dappPage.waitForFunction(() => typeof window.sendArc === 'function')
})

test.afterAll(async () => {
    await context.close()
    await new Promise<void>(resolve => server.close(() => resolve()))
})

test('sign_transactions before enable resolves UnauthorizedSignerError with no approval window', async () => {
    const pagesBefore = context.pages().length

    // Content doesn't matter — the permission check rejects first.
    await dappPage.evaluate(() => {
        window.signTxns([{ txn: 'AA==' }])
    })

    await expect
        .poll(() => dappPage.locator('#sign-error').textContent(), {
            timeout: 20_000,
        })
        .not.toBe('')

    const error = JSON.parse(
        (await dappPage.locator('#sign-error').textContent()) ?? '{}',
    ) as { code: number }
    expect(error.code).toBe(4100) // ARC0027_ERROR_CODES.UnauthorizedSignerError
    expect(await dappPage.locator('#sign-result').textContent()).toBe('')

    // Unauthorized short-circuits before any approval window opens.
    expect(context.pages().length).toBe(pagesBefore)
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])
})

test('enable connects the dapp, granting one account', async () => {
    const approvalPage = await openEnableApprovalPopup()
    expectApprovalSurfaceUrl(approvalPage)

    const unlockInput = approvalPage.getByTestId('unlock-password-input')
    if (await unlockInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await unlockInput.fill(PASSWORD)
        await approvalPage.getByTestId('unlock-submit').click()
    }

    await expect(approvalPage.getByTestId('dapp-enable-origin')).toBeVisible({
        timeout: 20_000,
    })
    const connectButton = approvalPage.getByTestId('dapp-enable-connect')
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
    grantedAddress = accounts[0].address

    // approve() calls window.close(); the real toolbar popup is terminal, but a
    // Playwright-opened tab won't self-close on script request, so close it
    // explicitly to emulate the popup's terminal teardown.
    await approvalPage.close()
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])
})

test('sign_transactions on a connected origin opens the approval popup and decodes the real txn for confirmation', async () => {
    const expectedGenesisHash = getNetworkConfig(Networks.mainnet).genesisHash
    const unsignedTxnB64 = buildUnsignedPaymentTxn(
        grantedAddress,
        expectedGenesisHash,
        'mainnet-v1.0',
    )

    await dappPage.evaluate(txn => window.signTxns([{ txn }]), unsignedTxnB64)
    const { approvalPage, approvalErrors } = await openApprovalPopup()
    // TTCDIAG: temporary instrumentation, remove before commit.
    const ttcLog: string[] = []
    const record = (label: string) => (m: { text: () => string; type: () => string }) => {
        ttcLog.push(`+${Date.now() % 1000000}ms [${label}/${m.type()}] ${m.text().slice(0, 400)}`)
        if (ttcLog.length > 300) ttcLog.shift()
    }
    approvalPage.on('console', record('approval'))
    approvalPage.on('pageerror', e =>
        ttcLog.push(`+${Date.now() % 1000000}ms [approval/PAGEERROR] ${String(e)}`),
    )
    dappPage.on('console', record('dapp'))
    expectApprovalSurfaceUrl(approvalPage)

    const unlockInput = approvalPage.getByTestId('unlock-password-input')
    if (await unlockInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await unlockInput.fill(PASSWORD)
        await approvalPage.getByTestId('unlock-submit').click()
    }

    // Proves the whole popup sign-delivery path — discover, decode, enqueue,
    // render — for the exact transaction the dapp sent.
    await expect(
        approvalPage.getByText('Review Transactions', { exact: false }),
    ).toBeVisible({ timeout: 20_000 })
    const shortAddr = new RegExp(
        `${grantedAddress.slice(0, 5)}.*${grantedAddress.slice(-5)}`,
    )
    await expect(approvalPage.getByText(shortAddr).first()).toBeVisible({
        timeout: 20_000,
    })
    const confirmControl = approvalPage.getByTestId('signing-confirm-slide')
    await expect(confirmControl).toBeVisible({ timeout: 20_000 })
    // The footer must be pinned inside the fixed 600px surface, not pushed
    // below the overflow:hidden fold.
    await expect(confirmControl).toBeInViewport()

    // Web always uses tap-to-confirm: first tap arms, second
    // confirms. Unlike the old slide gesture (which a synthetic pointer could
    // never complete), this lets the test drive acceptance end-to-end and
    // assert the signed txn actually reaches the dapp.
    await confirmControl.click()
    await confirmControl.click()

    // TTCDIAG: temporary instrumentation, remove before commit.
    try {
        await expect
            .poll(() => dappPage.locator('#sign-result').textContent(), {
                timeout: 20_000,
            })
            .not.toBe('')
    } catch (error) {
        console.log('[TTCDIAG] console log:\n  ' + ttcLog.join('\n  '))
        console.log(
            '[TTCDIAG] approvalPage closed=' +
                approvalPage.isClosed() +
                ' url=' +
                (approvalPage.isClosed() ? 'n/a' : approvalPage.url()),
        )
        console.log(
            '[TTCDIAG] pages:\n  ' +
                context
                    .pages()
                    .map(p => `${p.isClosed() ? '(closed) ' : ''}${p.url()}`)
                    .join('\n  '),
        )
        // Is a bottom sheet or the pin nudge sitting unanswered on the approval
        // surface right now? A held presentation is silent by design.
        for (const id of [
            'pin_security_prompt_not_now_button',
            'qr-scanner-sheet',
            'pw-bottom-sheet-stage',
            'pw-bottom-sheet-backdrop',
            'signing-confirm-slide',
        ]) {
            const visible = await approvalPage
                .getByTestId(id)
                .isVisible()
                .catch(() => 'error')
            console.log(`[TTCDIAG] approval testID ${id} visible=${visible}`)
        }
        const bodyText = await approvalPage
            .locator('body')
            .innerText()
            .catch(() => '<unavailable>')
        console.log(
            '[TTCDIAG] approval body text:\n' + bodyText.slice(0, 1200),
        )
        throw error
    }
    const signResult = JSON.parse(
        (await dappPage.locator('#sign-result').textContent()) ?? '{}',
    ) as { stxns?: string[] }
    expect(signResult.stxns?.length).toBe(1)
    expect(signResult.stxns?.[0]).toBeTruthy()

    expect(approvalErrors, 'approval popup threw an uncaught error').toEqual([])
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])
})

test('closing the approval popup rejects with MethodCanceledError', async () => {
    const expectedGenesisHash = getNetworkConfig(Networks.mainnet).genesisHash
    const unsignedTxnB64 = buildUnsignedPaymentTxn(
        grantedAddress,
        expectedGenesisHash,
        'mainnet-v1.0',
    )

    await dappPage.evaluate(txn => window.signTxns([{ txn }]), unsignedTxnB64)
    const { approvalPage } = await openApprovalPopup()
    expectApprovalSurfaceUrl(approvalPage)

    // Defensive — the vault should still be unlocked from the previous test.
    const unlockInput = approvalPage.getByTestId('unlock-password-input')
    if (await unlockInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await unlockInput.fill(PASSWORD)
        await approvalPage.getByTestId('unlock-submit').click()
    }
    await expect(approvalPage.getByTestId('signing-confirm-slide')).toBeVisible(
        { timeout: 20_000 },
    )

    // Closing fires `pagehide`, which useDappRequest turns into a
    // rejectApproval — a popup has no chrome.windows.onRemoved lifecycle, so
    // this is the same path a real blur/dismiss cancel takes.
    await approvalPage.close({ runBeforeUnload: true })

    await expect
        .poll(() => dappPage.locator('#sign-error').textContent(), {
            timeout: 20_000,
        })
        .not.toBe('')

    const error = JSON.parse(
        (await dappPage.locator('#sign-error').textContent()) ?? '{}',
    ) as { code: number }
    expect(error.code).toBe(4001) // ARC0027_ERROR_CODES.MethodCanceledError
    expect(await dappPage.locator('#sign-result').textContent()).toBe('')
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])
})
