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

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
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
} from '@perawallet/wallet-core-accounts'
import {
    mockAlgodAccountInformation,
    mockAlgodStatus,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'
import { LedgerSelectAccountsScreen, LedgerVerifyScreen } from '@modules/ledger'

import { isElementDisabled } from '@test-utils/rnw'
import { HD_TEST_ADDRESS, ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'
import { registerFakeLedgerProvider } from './__fixtures__/ledger'

const LEDGER_ADDRESS = HD_TEST_ADDRESS
const REKEYED_ADDRESS = ALGO25_TEST_ADDRESS

describe('Flow: Ledger rekeyed-account import', () => {
    beforeAll(async () => {
        await setupTestDatabase()
        registerFakeLedgerProvider({ address: LEDGER_ADDRESS })
    })
    afterAll(async () => {
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
                response: { amount: 1_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodAccountInformation({
                address: REKEYED_ADDRESS,
                response: {
                    amount: 5_000_000,
                    'min-balance': 100_000,
                    'auth-addr': LEDGER_ADDRESS,
                },
            }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockIndexerSearchForAccounts({
                response: { accounts: [{ address: REKEYED_ADDRESS }] },
            }),
        )
    })

    it('Given a discovered Ledger account with a rekeyed account, when the user selects only the rekeyed account and verifies, then it is imported as a watch account rekeyed to the auto-included Ledger account (RekeyedAuth)', async () => {
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
                additionalScreens: [
                    {
                        name: 'LedgerVerify',
                        component: LedgerVerifyScreen,
                    },
                    {
                        name: 'LedgerTroubleshooting',
                        component: () => null,
                    },
                ],
            },
        )

        // Wait for the rekeyed row to appear (indexer scan completes)
        const rekeyedRow = await waitFor(
            () => screen.getByTestId(`ledger_select_row_${REKEYED_ADDRESS}`),
            { timeout: 10_000 },
        )

        // Select the rekeyed account
        fireEvent.click(rekeyedRow)

        // Continue — the screen auto-includes the auth Ledger account
        fireEvent.click(
            screen.getByTestId('ledger_select_accounts_continue_button'),
        )

        // LedgerVerifyScreen: only the auth Ledger account (index 0) is
        // verified — the rekeyed address itself has no device card
        await waitFor(
            () =>
                expect(screen.getByTestId('ledger_verify_card_0')).toBeTruthy(),
            { timeout: 10_000 },
        )
        expect(screen.queryByTestId('ledger_verify_card_1')).toBeNull()

        // Verification runs on mount via the fake transport; wait for the
        // add button to become enabled
        const addBtn = await waitFor(
            () => {
                const btn = screen.getByTestId(
                    'ledger_verify_add_accounts_button',
                ) as HTMLButtonElement
                expect(isElementDisabled(btn)).toBe(false)
                return btn
            },
            { timeout: 10_000 },
        )

        fireEvent.click(addBtn)

        // Persisted accounts have the right types and the watch resolves
        // as signable via the hardware auth account.
        await waitFor(
            () => {
                const accounts = useAccountsStore.getState().accounts
                const watch = accounts.find(a => a.address === REKEYED_ADDRESS)
                const hw = accounts.find(a => a.address === LEDGER_ADDRESS)
                expect(watch?.type).toBe(AccountTypes.watch)
                expect(watch?.rekeyAddress).toBe(LEDGER_ADDRESS)
                expect(hw?.type).toBe(AccountTypes.hardware)
                expect(canSignWith(watch!, accounts)).toBe(true)
            },
            { timeout: 10_000 },
        )
    })
})
