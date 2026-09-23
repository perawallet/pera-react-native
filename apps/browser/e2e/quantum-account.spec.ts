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

// Quantum accounts in the real bundle: Falcon-1024 keygen through the web
// keystore, then a dApp signing request answered with a pqsig the node would
// accept. Networkless: the signature is checked here rather than submitted.
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
import { verifyCompressed } from 'falcon-1024'
import { getNetworkConfig, Networks } from '@perawallet/wallet-core-config'
import {
    openApprovalSurface,
    selectAccountAndArmConnect,
    trackPageErrors,
} from './approval-surface'
import { dismissPinPromptIfPresent } from './pin-prompt'

declare global {
    interface Window {
        /** The fixture's staging slot for the txn the sign button submits. */
        __txn: string | null
    }
}

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(here, '../dist')
const fixtureHtml = readFileSync(
    path.resolve(here, 'fixtures/window-pera-page.html'),
)

test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let extensionId: string
let page: Page
let pageErrors: Error[]
let dappPage: Page
let server: http.Server
let dappOrigin: string
let quantumAddress: string
const PASSWORD = 'e2e-quantum-account-password-1'

type StoredAccount = { type: string; address: string }

const readStoredAccounts = async (): Promise<StoredAccount[]> => {
    const [serviceWorker] = context.serviceWorkers()
    const raw = await serviceWorker.evaluate(
        async () =>
            (await chrome.storage.local.get('kv:accounts-store'))[
                'kv:accounts-store'
            ] as string | undefined,
    )
    const accounts = raw ? JSON.parse(raw).state?.accounts : undefined
    return Object.values(accounts ?? {}) as StoredAccount[]
}

const unlockIfNeeded = async (approvalPage: Page): Promise<void> => {
    const unlockInput = approvalPage.getByTestId('unlock-password-input')
    if (await unlockInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await unlockInput.fill(PASSWORD)
        await approvalPage.getByTestId('unlock-submit').click()
    }
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

    // The quantum option also needs `enable_quantum_accounts`, which an
    // exported build only gets from Firebase; the developer override stands in
    // for it so the run doesn't depend on a live Remote Config fetch.
    await serviceWorker.evaluate(async () => {
        await chrome.storage.local.set({
            'kv:settings-store': JSON.stringify({
                state: {
                    preferences: {
                        security_pin_setup_prompt: true,
                        'transaction-info-agreed': true,
                    },
                },
                version: 1,
            }),
            'kv:remote-config-store': JSON.stringify({
                state: { configOverrides: { enable_quantum_accounts: true } },
                version: 1,
            }),
        })
    })

    page = await context.newPage()
    pageErrors = trackPageErrors(page)
    await page.goto(`chrome-extension://${extensionId}/expanded.html`)

    await page.getByTestId('create-password-input').fill(PASSWORD)
    await page.getByTestId('create-password-confirm-input').fill(PASSWORD)
    await page.getByTestId('create-password-submit').click()
    await page
        .getByTestId('onboarding_create_wallet_button')
        .click({ timeout: 20_000 })
    await page.getByTestId('terms_agree_button').click({ timeout: 20_000 })
    await page
        .getByTestId('name_account_finish_button')
        .click({ timeout: 45_000 })
    await expect(page.getByTestId('account_screen')).toBeVisible({
        timeout: 30_000,
    })
})

test.afterAll(async () => {
    await context.close()
    await new Promise<void>(resolve => server.close(() => resolve()))
})

test('Add Account creates a quantum account through the web keystore', async () => {
    await dismissPinPromptIfPresent(page)
    await page.getByTestId('account_selection_button').click()
    await page
        .getByTestId('account_menu_add_account_button')
        .click({ timeout: 20_000 })
    await page
        .getByTestId('add_account_create_quantum_button')
        .click({ timeout: 20_000 })
    await page
        .getByTestId('name_account_finish_button')
        .click({ timeout: 60_000 })
    await expect(page.getByTestId('account_screen')).toBeVisible({
        timeout: 30_000,
    })

    const quantumAccounts = (await readStoredAccounts()).filter(
        account => account.type === 'quantum',
    )
    expect(quantumAccounts).toHaveLength(1)
    quantumAddress = quantumAccounts[0].address
    expect(algosdk.isValidAddress(quantumAddress)).toBe(true)
    expect(pageErrors, 'page threw an uncaught error').toEqual([])
})

test('a dApp signing request from the quantum account returns a valid Falcon pqsig', async () => {
    dappPage = await context.newPage()
    const dappPageErrors = trackPageErrors(dappPage)
    await dappPage.goto(dappOrigin)
    await dappPage.waitForFunction(() => typeof window.pera === 'object')

    await dappPage.getByTestId('connect').click()
    const connect = await openApprovalSurface({ context, page, extensionId })
    await unlockIfNeeded(connect.approvalPage)
    const connectButton = connect.approvalPage.getByTestId('wc-connect-connect')
    await selectAccountAndArmConnect(connect.approvalPage, connectButton)
    // Only the first account is preselected. The address label sits beside the
    // row's checkbox rather than inside it, so take the innermost element that
    // holds both, then its outer checkbox (the inner box is covered by it).
    await connect.approvalPage
        .locator('div')
        .filter({
            hasText: quantumAddress.slice(0, 5),
            has: connect.approvalPage.getByRole('checkbox'),
        })
        .last()
        .getByRole('checkbox')
        .first()
        .click()
    await connectButton.click()
    await expect
        .poll(() => dappPage.locator('#connect-result').textContent(), {
            timeout: 20_000,
        })
        .not.toBe('')
    const connected = JSON.parse(
        (await dappPage.locator('#connect-result').textContent()) ?? '{}',
    ) as { accounts: { address: string }[] }
    await connect.approvalPage.close()
    expect(connected.accounts.map(account => account.address)).toContain(
        quantumAddress,
    )

    const { genesisHash } = getNetworkConfig(Networks.mainnet)
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: quantumAddress,
        receiver: quantumAddress,
        amount: 0,
        suggestedParams: {
            fee: 3000n,
            minFee: 1000n,
            firstValid: 1000n,
            lastValid: 2000n,
            genesisID: 'mainnet-v1.0',
            genesisHash: new Uint8Array(Buffer.from(genesisHash, 'base64')),
            flatFee: true,
        },
    })
    await dappPage.evaluate(
        unsigned => {
            window.__txn = unsigned
        },
        Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64'),
    )
    await dappPage.getByTestId('sign').click()

    const signing = await openApprovalSurface({ context, page, extensionId })
    await unlockIfNeeded(signing.approvalPage)
    const confirmControl = signing.approvalPage.getByTestId(
        'signing-confirm-slide',
    )
    await expect(confirmControl).toBeVisible({ timeout: 20_000 })
    // Tap-to-confirm on web: the first tap arms, the second confirms.
    await confirmControl.click()
    await confirmControl.click()
    const dappWarning = signing.approvalPage.getByTestId(
        'quantum-dapp-warning-sheet',
    )
    await expect(dappWarning).toBeVisible({ timeout: 20_000 })
    await dappWarning.getByText('Continue', { exact: true }).click()

    await expect
        .poll(
            async () =>
                (await dappPage.locator('#sign-result').textContent()) ||
                (await dappPage.locator('#sign-error').textContent()) ||
                '',
            { timeout: 30_000 },
        )
        .not.toBe('')
    expect(
        await dappPage.locator('#sign-error').textContent(),
        'the wallet declined the sign request',
    ).toBe('')

    const [signedB64] = JSON.parse(
        (await dappPage.locator('#sign-result').textContent()) ?? '[]',
    ) as string[]
    const signed = algosdk.decodeSignedTransaction(
        new Uint8Array(Buffer.from(signedB64, 'base64')),
    )
    expect(signed.sig).toBeUndefined()
    const pqsig = signed.pqsig
    expect(pqsig).toBeDefined()
    if (!pqsig) return
    // The key must be the one the account's address commits to, and the
    // signature must verify over the same bytes the node checks. Those are the
    // signed txn's own bytes: the wallet raises the fee to the PQ minimum, so
    // they differ from the request.
    expect(signed.txn.sender.toString()).toBe(quantumAddress)
    expect(
        algosdk.addressFromPQKey(pqsig.sch, pqsig.pk).address.toString(),
    ).toBe(quantumAddress)
    expect(
        verifyCompressed(pqsig.pk, pqsig.sig, signed.txn.bytesToSign()),
    ).toBe(true)

    await signing.approvalPage.close()
    expect(signing.approvalErrors, 'approval surface threw').toEqual([])
    expect(dappPageErrors, 'dapp page threw an uncaught error').toEqual([])
})
