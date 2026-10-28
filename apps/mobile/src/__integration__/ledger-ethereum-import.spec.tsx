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

// The Ledger import runs on the chain the user picks: discovery, verification
// and the account it writes all use that chain. A device position the wallet
// already holds gains the chain once the device reads that account's address
// in its own chain's app; another seed behind the same device id gets its own
// account.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useRoute } from '@react-navigation/native'

import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { evmRpcHandlers } from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { findEnabledByTestId } from '@test-utils/rnw'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { ImportAccountOptionsScreen } from '@modules/onboarding/screens/ImportAccountOptionsScreen/ImportAccountOptionsScreen'
import {
    LedgerFetchAccountsScreen,
    LedgerSelectAccountsScreen,
    LedgerVerifyScreen,
} from '@modules/ledger'
import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import { registerFakeLedgerProvider } from './__fixtures__/ledger'

const RPC_URL = 'https://mainnet.rpc.test/'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
        chainEndpointsFor: (
            chainId: Parameters<typeof actual.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? { mainnet: RPC_URL, sepolia: RPC_URL }
                : actual.chainEndpointsFor(chainId),
    }
})

const DEVICE_ID = 'test-device-id'
// Hardhat account #3: the device's Ethereum address at index 0.
const ETHEREUM_ADDRESS = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
const ALGORAND_ADDRESS = HD_TEST_ADDRESS

const deviceAddress = (accountIndex: number, chainId: string): string => {
    if (chainId === 'ethereum') {
        return accountIndex === 0
            ? ETHEREUM_ADDRESS
            : `0x${(accountIndex + 1).toString(16).padStart(40, '0')}`
    }
    return ALGORAND_ADDRESS
}

const sameAddress = (a: string | undefined, b: string) =>
    a?.toLowerCase() === b.toLowerCase()

let pairParams: unknown = null
const LedgerPairProbe = () => {
    pairParams = useRoute().params
    return null
}

const renderEthereumImport = () =>
    renderWithNavigation(LedgerFetchAccountsScreen, 'LedgerFetchAccounts', {
        initialParams: {
            chainId: 'ethereum',
            deviceId: DEVICE_ID,
            deviceName: 'Ledger Nano X',
            transportType: 'ble',
        },
        additionalScreens: [
            {
                name: 'LedgerSelectAccounts',
                component: LedgerSelectAccountsScreen,
            },
            { name: 'LedgerVerify', component: LedgerVerifyScreen },
            { name: 'LedgerTroubleshooting', component: () => null },
        ],
    })

const ledgerOnAlgorand = (address: string) => ({
    id: 'ledger-algorand',
    name: 'Ledger 1',
    custody: {
        kind: 'hardware' as const,
        device: {
            manufacturer: 'ledger' as const,
            deviceId: DEVICE_ID,
            deviceName: 'Ledger Nano X',
            transportType: 'ble' as const,
        },
        accountIndex: 0,
    },
    chains: { algorand: { address } },
})

const confirmSameWallet = async () => {
    fireEvent.click(
        await waitFor(() => screen.getByTestId('ledger-same-wallet-confirm'), {
            timeout: 5000,
        }),
    )
}

const importIndexZero = async () => {
    const row = await waitFor(
        () => screen.getByTestId(`ledger_select_row_${ETHEREUM_ADDRESS}`),
        { timeout: 15_000 },
    )
    fireEvent.click(row)
    fireEvent.click(
        screen.getByTestId('ledger_select_accounts_continue_button'),
    )
    const addButton = await findEnabledByTestId(
        'ledger_verify_add_accounts_button',
        { timeout: 10_000 },
    )
    fireEvent.click(addButton)
}

describe('Flow: import a Ledger account on Ethereum', () => {
    beforeAll(async () => {
        await setupTestDatabase()
        registerFakeLedgerProvider({
            address: deviceAddress,
            chainIds: ['algorand', 'ethereum'],
        })
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        useAccountsStore.getState().setAccounts([])
        // Every probed index reads as unused: the scan offers index 0 alone.
        server.use(...evmRpcHandlers({ rpcUrl: RPC_URL }))
    })

    afterEach(() => {
        pairParams = null
        vi.restoreAllMocks()
    })

    it('Given Algorand and Ethereum both have Ledger on, when the user pairs a Ledger, then they choose the chain and pairing runs on it', async () => {
        const ble = getProvider().hardwareWalletRegistry.getProvider(
            'ledger',
            'ble',
        )!
        vi.spyOn(ble, 'isSupported').mockResolvedValue(true)
        renderWithNavigation(ImportAccountOptionsScreen, 'ImportOptions', {
            additionalScreens: [
                { name: 'LedgerPair', component: LedgerPairProbe },
            ],
        })

        fireEvent.click(
            await waitFor(() =>
                screen.getByTestId('import_account_options_pair_ledger_button'),
            ),
        )
        fireEvent.click(
            await waitFor(
                () => screen.getByTestId('chain_selection_ethereum'),
                {
                    timeout: 5000,
                },
            ),
        )

        await waitFor(() => expect(pairParams).toEqual({ chainId: 'ethereum' }))
    })

    it('Given a device with no account in the wallet, when the user imports index 0 on Ethereum, then a hardware account holds the device address there', async () => {
        renderEthereumImport()

        await importIndexZero()

        await waitFor(
            () => {
                const [account, ...rest] = useAccountsStore.getState().accounts
                expect(rest).toEqual([])
                expect(account?.custody).toMatchObject({
                    kind: 'hardware',
                    accountIndex: 0,
                    device: expect.objectContaining({ deviceId: DEVICE_ID }),
                })
                expect(
                    sameAddress(
                        account?.chains.ethereum?.address,
                        ETHEREUM_ADDRESS,
                    ),
                ).toBe(true)
                expect(account?.chains.algorand).toBeUndefined()
            },
            { timeout: 10_000 },
        )
    })

    it('Given the device already has an Algorand account at index 0, when the user imports index 0 on Ethereum and the Algorand app reads that address, then that account gains the Ethereum entry', async () => {
        useAccountsStore
            .getState()
            .setAccounts([ledgerOnAlgorand(ALGORAND_ADDRESS)])
        renderEthereumImport()

        await importIndexZero()
        await confirmSameWallet()

        await waitFor(
            () => {
                const accounts = useAccountsStore.getState().accounts
                expect(accounts).toHaveLength(1)
                expect(accounts[0].id).toBe('ledger-algorand')
                expect(accounts[0].name).toBe('Ledger 1')
                expect(accounts[0].chains.algorand?.address).toBe(
                    ALGORAND_ADDRESS,
                )
                expect(
                    sameAddress(
                        accounts[0].chains.ethereum?.address,
                        ETHEREUM_ADDRESS,
                    ),
                ).toBe(true)
            },
            { timeout: 10_000 },
        )
    })

    it('Given an Algorand account at index 0 of the same device id from another seed, when the user imports index 0 on Ethereum, then the Ethereum address gets its own account', async () => {
        useAccountsStore
            .getState()
            .setAccounts([ledgerOnAlgorand(ALGO25_TEST_ADDRESS)])
        renderEthereumImport()

        await importIndexZero()
        await confirmSameWallet()

        await waitFor(
            () => {
                const accounts = useAccountsStore.getState().accounts
                expect(accounts).toHaveLength(2)
                const [held, created] = accounts
                expect(held.id).toBe('ledger-algorand')
                expect(held.chains.algorand?.address).toBe(ALGO25_TEST_ADDRESS)
                expect(held.chains.ethereum).toBeUndefined()
                expect(created.custody).toMatchObject({
                    kind: 'hardware',
                    accountIndex: 0,
                    device: expect.objectContaining({ deviceId: DEVICE_ID }),
                })
                expect(
                    sameAddress(
                        created.chains.ethereum?.address,
                        ETHEREUM_ADDRESS,
                    ),
                ).toBe(true)
                expect(created.chains.algorand).toBeUndefined()
            },
            { timeout: 10_000 },
        )
    })
})
