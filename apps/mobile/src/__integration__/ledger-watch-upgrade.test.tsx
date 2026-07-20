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

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    AccountTypes,
    canSignWith,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    mockAlgodAccountInformation,
    mockAlgodStatus,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { LedgerSelectAccountsScreen } from '@modules/ledger/screens/LedgerSelectAccountsScreen'
import { LedgerVerifyScreen } from '@modules/ledger/screens/LedgerVerifyScreen'

import { HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000
const LEDGER_ADDRESS = HD_TEST_ADDRESS

const WATCH_ACCOUNT: WalletAccount = {
    id: 'watch-1',
    name: 'My Cold Wallet',
    type: AccountTypes.watch,
    address: LEDGER_ADDRESS,
}

const registerFakeLedgerProvider = () => {
    getProvider().hardwareWalletRegistry.register({
        manufacturer: 'ledger',
        transportType: 'ble',
        scan: () => () => {},
        connect: async () => ({
            getAddress: async (accountIndex: number) => ({
                address: LEDGER_ADDRESS,
                publicKey: new Uint8Array(32),
                accountIndex,
            }),
            signTransaction: async () => new Uint8Array(64),
            signData: async () => new Uint8Array(64),
            getAppVersion: async () => ({ major: 0, minor: 0, patch: 0 }),
            disconnect: async () => {},
        }),
        isSupported: async () => false,
    })
}

const renderImportFlow = () =>
    renderWithNavigation(LedgerSelectAccountsScreen, 'LedgerSelectAccounts', {
        initialParams: {
            deviceId: 'test-device-id',
            deviceName: 'Ledger Nano X',
            transportType: 'ble',
            accounts: [
                {
                    address: LEDGER_ADDRESS,
                    publicKeyHex: '01',
                    accountIndex: 0,
                },
            ],
        },
        additionalScreens: [
            { name: 'LedgerVerify', component: LedgerVerifyScreen },
            { name: 'LedgerTroubleshooting', component: () => null },
        ],
    })

const selectRowAndReachAddButton = async () => {
    const row = await waitFor(
        () => screen.getByTestId(`ledger_select_row_${LEDGER_ADDRESS}`),
        { timeout: 10_000 },
    )
    fireEvent.click(row)

    fireEvent.click(
        screen.getByTestId('ledger_select_accounts_continue_button'),
    )

    return waitFor(
        () => {
            const btn = screen.getByTestId(
                'ledger_verify_add_accounts_button',
            ) as HTMLButtonElement
            expect(btn.disabled).toBe(false)
            return btn
        },
        { timeout: 10_000 },
    )
}

describe('Flow: Ledger import upgrades a watch account', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
        registerFakeLedgerProvider()
    })
    afterEach(() => server.resetHandlers())
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([WATCH_ACCOUNT])

        server.use(
            mockAlgodAccountInformation({
                address: LEDGER_ADDRESS,
                response: { amount: 1_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockIndexerSearchForAccounts({ response: { accounts: [] } }),
        )
    })

    it(
        'Given the Ledger address exists as a watch account, when the user imports it and confirms the upgrade, then the watch account becomes a signable hardware account with its name preserved',
        async () => {
            renderImportFlow()

            const addBtn = await selectRowAndReachAddButton()
            fireEvent.click(addBtn)

            const confirmBtn = await waitFor(
                () => screen.getByTestId('ledger-watch-upgrade-confirm'),
                { timeout: 10_000 },
            )
            fireEvent.click(confirmBtn)

            await waitFor(
                () => {
                    const accounts = useAccountsStore.getState().accounts
                    expect(accounts).toHaveLength(1)
                    const upgraded = accounts[0]
                    expect(upgraded.type).toBe(AccountTypes.hardware)
                    expect(upgraded.name).toBe('My Cold Wallet')
                    expect(upgraded.id).toBe('watch-1')
                    expect(
                        upgraded.type === AccountTypes.hardware &&
                            upgraded.hardwareDetails.deviceId,
                    ).toBe('test-device-id')
                    expect(canSignWith(upgraded, accounts)).toBe(true)
                },
                { timeout: 10_000 },
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the Ledger address exists as a watch account, when the user declines the upgrade, then nothing is written and the flow stays on the verify screen',
        async () => {
            renderImportFlow()

            const addBtn = await selectRowAndReachAddButton()
            fireEvent.click(addBtn)

            const cancelBtn = await waitFor(
                () => screen.getByTestId('ledger-watch-upgrade-cancel'),
                { timeout: 10_000 },
            )
            fireEvent.click(cancelBtn)

            await waitFor(
                () => {
                    const accounts = useAccountsStore.getState().accounts
                    expect(accounts).toEqual([WATCH_ACCOUNT])
                    expect(
                        screen.getByTestId('ledger_verify_add_accounts_button'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
