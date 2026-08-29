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
import React from 'react'
import { Decimal } from 'decimal.js'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'

import { server } from '@test-utils/msw-server'
import { createTestQueryClient } from '@test-utils/render'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    AccountTypes,
    insertAssetHolding,
    invalidateAccountQueriesForAddresses,
    refreshAccountHoldings,
    upsertAccountBalance,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useShouldPromptMnemonicBackup } from '@perawallet/wallet-core-backup'

const NETWORK = 'mainnet' as const

const ACCOUNT_A: WalletAccount = {
    id: 'reactivity-a',
    type: AccountTypes.algo25,
    address: 'A'.repeat(58),
    keyPairId: 'reactivity-a-key',
    name: 'Funder',
}

const ACCOUNT_B: WalletAccount = {
    id: 'reactivity-b',
    type: AccountTypes.hdWallet,
    address: 'B'.repeat(58),
    keyPairId: 'reactivity-b-key',
    name: 'Needs backup',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: 9,
    },
}

const seedUnfunded = async (address: string) => {
    await upsertAccountBalance({
        accountAddress: address,
        network: NETWORK,
        algoBalance: new Decimal(0),
        totalAssetsOptedIn: 0,
        totalCreatedAssets: 0,
        totalAppsOptedIn: 0,
        minBalance: new Decimal(100_000),
        status: 'Offline',
        authAddress: null,
    })
    await insertAssetHolding({
        accountAddress: address,
        assetId: '0',
        network: NETWORK,
        amount: '0',
    })
}

describe('Flow: backup badge reacts to funding and rekey without remount', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'bypass' })
        await setupTestDatabase()
    })
    afterEach(() => server.resetHandlers())
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset(NETWORK)
        useAccountsStore.getState().setAccounts([ACCOUNT_A, ACCOUNT_B])
    })

    it('Given an unfunded never-backed-up account, when its ALGO holding is refreshed and account queries invalidated (the post-send path), then the prompt flips to true', async () => {
        await seedUnfunded(ACCOUNT_B.address)

        const queryClient = createTestQueryClient()
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )

        const { result } = renderHook(
            () => useShouldPromptMnemonicBackup(ACCOUNT_B),
            { wrapper },
        )

        await waitFor(() => expect(result.current).toBe(false))

        // What SyncService.refreshAccounts does after the send confirms:
        // persist fresh chain state, then invalidate the account's queries.
        await act(async () => {
            await refreshAccountHoldings({
                accountAddress: ACCOUNT_B.address,
                network: NETWORK,
                holdings: [
                    {
                        assetId: '0',
                        amount: new Decimal(5_000_000),
                        isFrozen: false,
                    },
                ],
            })
            invalidateAccountQueriesForAddresses(queryClient, [
                ACCOUNT_B.address,
            ])
        })

        await waitFor(() => expect(result.current).toBe(true))
    })

    it('Given an unfunded never-backed-up account, when another account is rekeyed to it (store update from the post-confirmation account fetch), then the prompt flips to true', async () => {
        await seedUnfunded(ACCOUNT_B.address)

        const queryClient = createTestQueryClient()
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )

        const { result } = renderHook(
            () => useShouldPromptMnemonicBackup(ACCOUNT_B),
            { wrapper },
        )

        await waitFor(() => expect(result.current).toBe(false))

        // What fetchAndPersistAccount does when it sees the new auth-addr.
        act(() => {
            useAccountsStore
                .getState()
                .updateAccountRekeyAddress(
                    ACCOUNT_A.address,
                    ACCOUNT_B.address,
                    NETWORK,
                )
        })

        await waitFor(() => expect(result.current).toBe(true))
    })
})
