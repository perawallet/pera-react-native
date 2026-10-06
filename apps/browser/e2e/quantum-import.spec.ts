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

// Quantum passphrase import in the real bundle. Import derives a canonical and
// a legacy candidate, probes algod for each and mints whichever exists, so the
// algod answer is mocked per case and the minted address checked against
// addresses derived here, independently of the extension. The same words typed
// into the standard flow must not silently mint an empty algo25 account.
import {
    expect,
    test,
    chromium,
    type BrowserContext,
    type Page,
    type Route,
} from '@playwright/test'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import algosdk from 'algosdk'
import { generateKey } from 'falcon-1024'
import { getNetworkConfig, Networks } from '@perawallet/wallet-core-config'
import { dismissPinPromptIfPresent } from './pin-prompt'
import { trackPageErrors } from './approval-surface'

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(here, '../dist')
const PASSWORD = 'e2e-quantum-import-password-1'

// THROWAWAY TEST VECTOR, published in source; NEVER fund either address.
const MNEMONIC =
    'evoke unique jaguar rapid silent sister kingdom farm anger brother begin fluid brave sister mixture wedding suffer spin spatial combine ginger neutral lunch absorb upset'
// Pinned independently of the derivation below, which is checked against it.
const PINNED_CANONICAL_ADDRESS =
    'H325AXRDHRSZU5727LVZKTKYJVRRGD2MNUXVSPUONMSPTRCXQLWIU36CLI'

const addressFromFalconSeed = (seed: Uint8Array): string =>
    algosdk
        .addressFromPQKey(
            algosdk.FALCON_1024_SCHEME,
            generateKey(seed).publicKey,
        )
        .address.toString()

const entropy = algosdk.seedFromMnemonic(MNEMONIC)
// `SHA512_256("PQK" || scheme || entropy)`, go-algorand's `derivePQKeySeed`.
const canonicalSeed = new Uint8Array(
    createHash('sha512-256')
        .update(Buffer.from('PQK'))
        .update(algosdk.FALCON_1024_SCHEME)
        .update(entropy)
        .digest(),
)
const CANONICAL_ADDRESS = addressFromFalconSeed(canonicalSeed)
const LEGACY_ADDRESS = addressFromFalconSeed(entropy)

type ChainState = 'canonical' | 'legacy' | 'none' | 'probe-fails'

type StoredAccount = { type: string; address: string }

const accountJson = (address: string, amount: number) => ({
    address,
    amount,
    'amount-without-pending-rewards': amount,
    'min-balance': 100_000,
    'pending-rewards': 0,
    rewards: 0,
    round: 1000,
    status: 'Offline',
    'total-apps-opted-in': 0,
    'total-assets-opted-in': 0,
    'total-created-apps': 0,
    'total-created-assets': 0,
})

// algod `GET /v2/accounts/{address}` on any host, so a wrong network still
// gets an answer and shows up in `probed` instead of hanging on a live node.
const ALGOD_ACCOUNT = /\/v2\/accounts\/([A-Z2-7]{58})(?:[/?]|$)/

type Wallet = {
    context: BrowserContext
    page: Page
    probed: { host: string; address: string }[]
    readAccounts: () => Promise<StoredAccount[]>
}

// A fresh profile past the password and terms, on the import options screen.
const openImportOptions = async (
    chainState: ChainState,
    { isQuantumEnabled = true }: { isQuantumEnabled?: boolean } = {},
): Promise<Wallet> => {
    const context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        args: [
            `--disable-extensions-except=${dist}`,
            `--load-extension=${dist}`,
        ],
    })
    const probed: { host: string; address: string }[] = []
    await context.route(ALGOD_ACCOUNT, async (route: Route) => {
        const url = new URL(route.request().url())
        const address = ALGOD_ACCOUNT.exec(url.pathname)?.[1] ?? ''
        // Only the plain account lookup is the probe; sub-resources
        // (assets, applications) fall through to the live endpoint.
        if (!url.pathname.endsWith(address)) return route.fallback()
        probed.push({ host: url.host, address })
        if (chainState === 'probe-fails') {
            return route.fulfill({ status: 503, body: 'unavailable' })
        }
        const exists =
            (chainState === 'canonical' && address === CANONICAL_ADDRESS) ||
            (chainState === 'legacy' && address === LEGACY_ADDRESS)
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(accountJson(address, exists ? 5_000_000 : 0)),
        })
    })

    let [serviceWorker] = context.serviceWorkers()
    if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker')
    }
    const extensionId = new URL(serviceWorker.url()).host
    // Explicit either way: the bundle's own default depends on the build env.
    await serviceWorker.evaluate(async isEnabled => {
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
                state: {
                    configOverrides: { enable_quantum_accounts: isEnabled },
                },
                version: 1,
            }),
        })
    }, isQuantumEnabled)

    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/expanded.html`)
    await page.getByTestId('create-password-input').fill(PASSWORD)
    await page.getByTestId('create-password-confirm-input').fill(PASSWORD)
    await page.getByTestId('create-password-submit').click()
    await page
        .getByTestId('onboarding_import_account_button')
        .click({ timeout: 20_000 })
    await page.getByTestId('terms_agree_button').click({ timeout: 20_000 })

    const readAccounts = async (): Promise<StoredAccount[]> => {
        const raw = await serviceWorker.evaluate(
            async () =>
                (await chrome.storage.local.get('kv:accounts-store'))[
                    'kv:accounts-store'
                ] as string | undefined,
        )
        return Object.values(
            (raw ? JSON.parse(raw).state?.accounts : undefined) ?? {},
        ) as StoredAccount[]
    }

    return { context, page, probed, readAccounts }
}

const enterWordsAndImport = async (page: Page): Promise<void> => {
    for (const [index, word] of MNEMONIC.split(' ').entries()) {
        await page.getByTestId(`import_account_word_input_${index}`).fill(word)
    }
    const importButton = page.getByTestId('import_account_import_button')
    await expect(importButton).toBeEnabled({ timeout: 20_000 })
    await importButton.click()
}

const finishNaming = async (page: Page): Promise<void> => {
    await page
        .getByTestId('name_account_finish_button')
        .click({ timeout: 60_000 })
    await expect(page.getByTestId('account_screen')).toBeVisible({
        timeout: 30_000,
    })
    await dismissPinPromptIfPresent(page)
}

const quantumAddressesOf = (accounts: StoredAccount[]): string[] =>
    accounts
        .filter(account => account.type === 'quantum')
        .map(account => account.address)
        .sort()

const runQuantumImport = async (
    chainState: ChainState,
): Promise<{
    quantumAddresses: string[]
    probed: { host: string; address: string }[]
}> => {
    const { context, page, probed, readAccounts } =
        await openImportOptions(chainState)
    try {
        const pageErrors = trackPageErrors(page)
        await page
            .getByTestId('import_account_quantum_button')
            .click({ timeout: 20_000 })
        await enterWordsAndImport(page)
        await finishNaming(page)
        expect(pageErrors, 'page threw an uncaught error').toEqual([])
        return {
            quantumAddresses: quantumAddressesOf(await readAccounts()),
            probed,
        }
    } finally {
        await context.close()
    }
}

// The path a user with only "Recover a wallet" in front of them takes.
const enterQuantumWordsAsStandard = async (page: Page): Promise<void> => {
    await page
        .getByTestId('import_account_options_recover_wallet_button')
        .click({ timeout: 20_000 })
    await page
        .getByTestId('import_options_algo25_button')
        .click({ timeout: 20_000 })
    await page
        .getByTestId('import_info_recover_button')
        .click({ timeout: 20_000 })
    await enterWordsAndImport(page)
}

// A fresh profile defaults to MainNet; probing any other network would miss a
// funded account and silently mint the canonical address instead.
const expectMainnetProbeOfBoth = (
    probed: { host: string; address: string }[],
): void => {
    const mainnetHost = new URL(getNetworkConfig(Networks.mainnet).algodUrl)
        .host
    expect(new Set(probed.map(probe => probe.host))).toEqual(
        new Set([mainnetHost]),
    )
    expect(new Set(probed.map(probe => probe.address))).toEqual(
        new Set([CANONICAL_ADDRESS, LEGACY_ADDRESS]),
    )
}

test('the locally derived canonical address matches the pinned vector', () => {
    expect(CANONICAL_ADDRESS).toBe(PINNED_CANONICAL_ADDRESS)
    expect(LEGACY_ADDRESS).not.toBe(CANONICAL_ADDRESS)
})

test('imports the canonical address when only it exists on chain', async () => {
    const { quantumAddresses, probed } = await runQuantumImport('canonical')
    expectMainnetProbeOfBoth(probed)
    expect(quantumAddresses).toEqual([CANONICAL_ADDRESS])
})

test('imports the legacy address when only it exists on chain', async () => {
    const { quantumAddresses, probed } = await runQuantumImport('legacy')
    expectMainnetProbeOfBoth(probed)
    expect(quantumAddresses).toEqual([LEGACY_ADDRESS])
})

test('falls back to the canonical address when neither exists', async () => {
    const { quantumAddresses, probed } = await runQuantumImport('none')
    expectMainnetProbeOfBoth(probed)
    expect(quantumAddresses).toEqual([CANONICAL_ADDRESS])
})

test('imports both candidates when the existence probe fails', async () => {
    const { quantumAddresses, probed } = await runQuantumImport('probe-fails')
    expectMainnetProbeOfBoth(probed)
    expect(quantumAddresses).toEqual([CANONICAL_ADDRESS, LEGACY_ADDRESS].sort())
})

test('Recover a wallet with quantum words offers the quantum account instead', async () => {
    const { context, page, readAccounts } = await openImportOptions('canonical')
    try {
        await enterQuantumWordsAsStandard(page)
        const sheet = page.getByTestId('quantum_passphrase_detected_sheet')
        await expect(sheet).toBeVisible({ timeout: 30_000 })
        await expect(
            page.getByTestId('quantum_passphrase_detected_sheet_address'),
        ).toHaveText(CANONICAL_ADDRESS)

        await page
            .getByTestId('quantum_passphrase_detected_sheet_import_quantum')
            .click()
        await finishNaming(page)

        const accounts = await readAccounts()
        expect(quantumAddressesOf(accounts)).toEqual([CANONICAL_ADDRESS])
        expect(accounts).toHaveLength(1)
    } finally {
        await context.close()
    }
})

test('Recover a wallet with quantum words imports nothing while quantum accounts are off', async () => {
    const { context, page, readAccounts } = await openImportOptions('legacy', {
        isQuantumEnabled: false,
    })
    try {
        await enterQuantumWordsAsStandard(page)
        await expect(
            page.getByTestId('quantum_passphrase_detected_sheet'),
        ).toBeVisible({ timeout: 30_000 })
        await expect(
            page.getByTestId('quantum_passphrase_detected_sheet_address'),
        ).toHaveText(LEGACY_ADDRESS)
        await expect(
            page.getByTestId(
                'quantum_passphrase_detected_sheet_import_quantum',
            ),
        ).toHaveCount(0)

        await page.getByTestId('quantum_passphrase_detected_sheet_back').click()

        await expect(
            page.getByTestId('import_account_import_button'),
        ).toBeEnabled()
        expect(await readAccounts()).toEqual([])
    } finally {
        await context.close()
    }
})
