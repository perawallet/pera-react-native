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
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    mockAlgodAccountInformation,
    mockAlgodStatus,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'
import { LedgerSelectAccountsScreen } from '@modules/ledger/screens/LedgerSelectAccountsScreen'

import { HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000

const LEDGER_ADDRESS = HD_TEST_ADDRESS

describe('Flow: Ledger account info sheet', () => {
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
        'Given a discovered Ledger account, when the user taps the ⓘ affordance, then the account info sheet opens and shows the Ledger title and account info list',
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

            // Assert the ⓘ affordance renders for the discovered account
            const infoButton = await screen.findByTestId(
                `ledger_select_row_${LEDGER_ADDRESS}-info`,
            )

            // Sheet should NOT be open initially
            expect(screen.queryByTestId('ledger_account_info_list')).toBeNull()

            // Tap the ⓘ button to open the info sheet
            fireEvent.click(infoButton)

            // Sheet opened and the list rendered
            await waitFor(
                () =>
                    expect(
                        screen.getByTestId('ledger_account_info_list'),
                    ).toBeTruthy(),
                { timeout: 10_000 },
            )

            // The sheet title is the i18n key (integration harness doesn't
            // initialise i18n — t() returns the raw key, see comment below).
            await waitFor(
                () =>
                    expect(
                        screen.getByText('ledger.account_info.default_title'),
                    ).toBeTruthy(),
                { timeout: 10_000 },
            )

            // Section headers should be rendered.
            // Note: i18n is not initialised in the integration test harness,
            // so t() returns the raw key — assert on what is actually rendered.
            await waitFor(
                () => {
                    expect(
                        screen.getByText('ledger.account_info.account_details'),
                    ).toBeTruthy()
                    expect(
                        screen.getByText('ledger.account_info.assets'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
