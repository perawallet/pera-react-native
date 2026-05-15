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

// Integration coverage for the rescan-rekeyed flow:
//
//   open screen ─► indexer search for accounts rekeyed to the source
//               ─► candidate rows ─► import ─► persisted as watch accounts
//
// No signing pipeline is involved — this exercises the indexer discovery
// (`fetchRekeyedAddresses`) and the store persistence
// (`addRekeyedWatchAccounts`).

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
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { mockIndexerSearchForAccounts } from '@perawallet/wallet-core-blockchain/test-handlers'
import { RescanRekeyedSelectScreen } from '@modules/rekey/rescan-rekeyed/screens/RescanRekeyedSelectScreen'

import {
    ALGO25_TEST_ADDRESS,
    HD_TEST_ADDRESS,
    REKEY_TARGET_ADDRESS,
} from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30000

const SOURCE: WalletAccount = {
    id: 'rescan-source',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'rescan-source-key',
    name: 'Source',
}

// `handleAddSelected` navigates to the tab bar once the import succeeds; a
// stub keeps the flat test navigator from hitting a no-route.
const TabBarStub = () => null

const renderRescan = () =>
    renderWithNavigation(RescanRekeyedSelectScreen, 'RescanRekeyedSelect', {
        initialParams: { sourceAddress: ALGO25_TEST_ADDRESS },
        additionalScreens: [{ name: 'TabBar', component: TabBarStub }],
    })

describe('Flow: Rescan rekeyed accounts (indexer discovery + import)', () => {
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
        useAccountsStore.getState().setAccounts([SOURCE])
        useAccountsStore.getState().setSelectedAccountAddress(SOURCE.address)
    })

    it(
        'Given the indexer reports accounts rekeyed to the source, when the user imports the candidates, then they are persisted as watch accounts pointing at the source',
        async () => {
            server.use(
                mockIndexerSearchForAccounts({
                    response: {
                        accounts: [
                            { address: HD_TEST_ADDRESS },
                            { address: REKEY_TARGET_ADDRESS },
                        ],
                    },
                }),
            )

            renderRescan()

            await waitFor(() => {
                expect(
                    screen.getByTestId('rescan-rekeyed-select-screen'),
                ).toBeTruthy()
            })
            expect(
                screen.getByTestId(`rescan-rekeyed-row-${HD_TEST_ADDRESS}`),
            ).toBeTruthy()
            expect(
                screen.getByTestId(
                    `rescan-rekeyed-row-${REKEY_TARGET_ADDRESS}`,
                ),
            ).toBeTruthy()

            // Candidates are default-selected after the scan resolves, so a
            // single tap on the CTA imports them.
            fireEvent.click(screen.getByTestId('rescan-rekeyed-add'))

            await waitFor(() => {
                const addresses = useAccountsStore
                    .getState()
                    .accounts.map(a => a.address)
                expect(addresses).toContain(HD_TEST_ADDRESS)
                expect(addresses).toContain(REKEY_TARGET_ADDRESS)
            })

            const imported = useAccountsStore
                .getState()
                .accounts.filter(a => a.address !== ALGO25_TEST_ADDRESS)
            expect(imported).toHaveLength(2)
            imported.forEach(account => {
                expect(account.type).toBe(AccountTypes.watch)
                expect(account.rekeyAddress).toBe(ALGO25_TEST_ADDRESS)
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the indexer reports no rekeyed accounts, when the screen scans, then the empty state renders',
        async () => {
            server.use(mockIndexerSearchForAccounts())

            renderRescan()

            await waitFor(() => {
                expect(screen.getByTestId('rescan-rekeyed-empty')).toBeTruthy()
            })
            // Nothing was imported — only the seeded source remains.
            expect(useAccountsStore.getState().accounts).toHaveLength(1)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the indexer request fails, when the screen scans, then the error state renders instead of the empty state',
        async () => {
            server.use(mockIndexerSearchForAccounts({ status: 500 }))

            renderRescan()

            // The indexer failure must surface as an error — not be swallowed
            // and shown as "no rekeyed accounts found". The indexer client
            // retries the 500 with backoff before giving up, so allow a
            // generous window.
            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('rescan-rekeyed-error'),
                    ).toBeTruthy()
                },
                { timeout: 15000 },
            )
            expect(screen.queryByTestId('rescan-rekeyed-empty')).toBeNull()
            expect(useAccountsStore.getState().accounts).toHaveLength(1)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
