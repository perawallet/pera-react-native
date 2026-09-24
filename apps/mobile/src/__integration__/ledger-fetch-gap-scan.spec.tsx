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

// Initial Ledger fetch drives the on-chain gap scan: funded accounts past
// unfunded gaps (indices {0, 5}) surface in one pass, and a dead probe
// degrades to the shallow capped scan instead of failing discovery.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import { http, HttpResponse } from 'msw'
import { useRoute } from '@react-navigation/native'
import { waitFor } from '@testing-library/react'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { mockAccountFastLookup } from '@perawallet/wallet-core-shared/test-handlers'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    LedgerFetchAccountsScreen,
    type SerializedLedgerAccount,
} from '@modules/ledger'
import { registerFakeLedgerProvider } from './__fixtures__/ledger'

// One deterministic 58-char address per derivation index.
const addressForIndex = (index: number): string =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[index].repeat(58)

const FUNDED_INDICES = new Set([0, 5])
// The scan visits indices 0..10: index 5 funded resets the gap, then five
// consecutive unfunded indices (6-10) exhaust it.
const PROBED_INDICES = 11

// Captures the params the fetch screen forwards to the select screen.
let capturedAccounts: SerializedLedgerAccount[] | null = null
const SelectAccountsProbe = () => {
    const route = useRoute()
    capturedAccounts = (route.params as { accounts: SerializedLedgerAccount[] })
        .accounts
    return null
}

const renderFetch = () =>
    renderWithNavigation(LedgerFetchAccountsScreen, 'LedgerFetchAccounts', {
        initialParams: {
            deviceId: 'test-device-id',
            deviceName: 'Ledger Nano X',
            transportType: 'ble',
        },
        additionalScreens: [
            { name: 'LedgerSelectAccounts', component: SelectAccountsProbe },
            { name: 'LedgerTroubleshooting', component: () => null },
        ],
    })

describe('Flow: Ledger initial fetch with on-chain gap scan', () => {
    beforeAll(async () => {
        await setupTestDatabase()
        registerFakeLedgerProvider({ address: addressForIndex })
    })
    afterEach(() => {
        capturedAccounts = null
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
    })

    it('lists funded accounts at indices {0, 5} in the initial fetch', async () => {
        server.use(
            ...Array.from({ length: PROBED_INDICES }, (_, index) =>
                mockAccountFastLookup({
                    address: addressForIndex(index),
                    response: { account_exists: FUNDED_INDICES.has(index) },
                }),
            ),
        )

        renderFetch()

        await waitFor(
            () => {
                expect(capturedAccounts).not.toBeNull()
            },
            { timeout: 10_000 },
        )
        expect(capturedAccounts!.map(a => a.accountIndex)).toEqual([0, 5])
    })

    it('degrades to the capped scan when the probe is unreachable', async () => {
        server.use(
            http.get('*/v1/accounts/fast-lookup/*', () =>
                HttpResponse.json({}, { status: 503 }),
            ),
        )

        renderFetch()

        await waitFor(
            () => {
                expect(capturedAccounts).not.toBeNull()
            },
            { timeout: 10_000 },
        )
        expect(capturedAccounts!.map(a => a.accountIndex)).toEqual([0, 1, 2])
    })
})
