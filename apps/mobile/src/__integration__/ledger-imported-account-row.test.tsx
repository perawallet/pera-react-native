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
import { screen, waitFor } from '@testing-library/react'

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
    useAccountsStore,
    type HardwareWalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    mockAlgodAccountInformation,
    mockAlgodStatus,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'
import { LedgerSelectAccountsScreen } from '@modules/ledger/screens/LedgerSelectAccountsScreen'

import { HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000

const LEDGER_ADDRESS = HD_TEST_ADDRESS

describe('Flow: Ledger imported account row checkbox', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
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
        useAccountsStore.getState().setAccounts([])

        useAccountsStore.getState().setAccounts([
            {
                id: 'hw-ledger-1',
                type: AccountTypes.hardware,
                address: LEDGER_ADDRESS,
                hardwareDetails: {
                    manufacturer: 'ledger',
                    deviceId: 'd',
                    deviceName: 'Ledger Nano X',
                    accountIndex: 0,
                    transportType: 'ble',
                },
            } satisfies HardwareWalletAccount,
        ])

        server.use(
            mockAlgodAccountInformation({
                address: LEDGER_ADDRESS,
                response: { amount: 408_200_000, 'min-balance': 100_000 },
            }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockIndexerSearchForAccounts(),
        )
    })

    it(
        'Given an already-imported Ledger account discovered on the select-accounts screen, the row shows the already-imported chip in place of a checkbox',
        async () => {
            renderWithNavigation(
                LedgerSelectAccountsScreen,
                'LedgerSelectAccounts',
                {
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
                },
            )

            await waitFor(
                () =>
                    expect(
                        screen.queryByText(
                            'ledger.select_accounts.already_imported',
                        ),
                    ).not.toBeNull(),
                { timeout: 10_000 },
            )

            expect(
                screen.queryByTestId(
                    `ledger_select_row_${LEDGER_ADDRESS}-checkbox`,
                ),
            ).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
