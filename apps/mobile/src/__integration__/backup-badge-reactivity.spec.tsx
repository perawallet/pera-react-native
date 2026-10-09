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
import React from 'react'
import { Decimal } from 'decimal.js'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'

import { createTestQueryClient } from '@test-utils/render'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    insertAssetHolding,
    invalidateAccountQueriesForAddresses,
    refreshAccountHoldings,
    upsertAccountBalance,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useShouldPromptMnemonicBackup } from '@perawallet/wallet-core-backup'
import {
    useNetworkStore,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import {
    LEGACY_CHAIN_ID,
    scopeForLegacyNetwork,
    type LegacyNetwork,
} from '@perawallet/wallet-core-chain-contract'
import { addressOf } from './__fixtures__/accounts'

const TESTNET_SCOPE = scopeForLegacyNetwork('testnet')

const NETWORK = 'mainnet' as const

const ACCOUNT_A: WalletAccount = {
    id: 'reactivity-a',
    custody: { kind: 'local', seed: 'algo25' },
    chains: {
        algorand: { address: 'A'.repeat(58), keyPairId: 'reactivity-a-key' },
    },
    name: 'Funder',
}

const ACCOUNT_B: WalletAccount = {
    id: 'reactivity-b',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: {
        algorand: { address: 'B'.repeat(58), keyPairId: 'reactivity-b-key' },
    },
    name: 'Needs backup',
}

const seedUnfunded = async (
    address: string,
    network: LegacyNetwork = NETWORK,
) => {
    await upsertAccountBalance({
        accountAddress: address,
        scope: scopeForLegacyNetwork(network),
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
        scope: scopeForLegacyNetwork(network),
        amount: '0',
    })
}

describe('Flow: backup badge reacts to funding and rekey without remount', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset(NETWORK)
        useAccountsStore.getState().setAccounts([ACCOUNT_A, ACCOUNT_B])
    })

    it('Given an unfunded never-backed-up account, when its ALGO holding is refreshed and account queries invalidated (the post-send path), then the prompt flips to true', async () => {
        await seedUnfunded(addressOf(ACCOUNT_B))

        const queryClient = createTestQueryClient()
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )

        const { result } = renderHook(
            () =>
                useShouldPromptMnemonicBackup(
                    ACCOUNT_B,
                    useSelectedScope(LEGACY_CHAIN_ID),
                ),
            { wrapper },
        )

        await waitFor(() => expect(result.current).toBe(false))

        // What SyncService.refreshAccounts does after the send confirms:
        // persist fresh chain state, then invalidate the account's queries.
        await act(async () => {
            await refreshAccountHoldings({
                accountAddress: addressOf(ACCOUNT_B),
                scope: scopeForLegacyNetwork(NETWORK),
                holdings: [
                    {
                        assetId: '0',
                        amount: new Decimal(5_000_000),
                        isFrozen: false,
                    },
                ],
            })
            invalidateAccountQueriesForAddresses(queryClient, [
                addressOf(ACCOUNT_B),
            ])
        })

        await waitFor(() => expect(result.current).toBe(true))
    })

    it('Given an account funded only on testnet, when mainnet is the selected network, then the prompt is still true', async () => {
        await seedUnfunded(addressOf(ACCOUNT_B))
        await seedUnfunded(addressOf(ACCOUNT_B), 'testnet')
        await refreshAccountHoldings({
            accountAddress: addressOf(ACCOUNT_B),
            scope: TESTNET_SCOPE,
            holdings: [
                {
                    assetId: '0',
                    amount: new Decimal(5_000_000),
                    isFrozen: false,
                },
            ],
        })
        useNetworkStore.getState().setNetwork(NETWORK)

        const queryClient = createTestQueryClient()
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )

        const { result } = renderHook(
            () =>
                useShouldPromptMnemonicBackup(
                    ACCOUNT_B,
                    useSelectedScope(LEGACY_CHAIN_ID),
                ),
            { wrapper },
        )

        await waitFor(() => expect(result.current).toBe(true))
    })

    it('Given an unfunded never-backed-up account, when another account is rekeyed to it (store update from the post-confirmation account fetch), then the prompt flips to true', async () => {
        await seedUnfunded(addressOf(ACCOUNT_B))

        const queryClient = createTestQueryClient()
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )

        const { result } = renderHook(
            () =>
                useShouldPromptMnemonicBackup(
                    ACCOUNT_B,
                    useSelectedScope(LEGACY_CHAIN_ID),
                ),
            { wrapper },
        )

        await waitFor(() => expect(result.current).toBe(false))

        // What fetchAndPersistAccount does when it sees the new auth-addr.
        act(() => {
            useAccountsStore
                .getState()
                .updateAccountRekeyAddress(
                    addressOf(ACCOUNT_A),
                    addressOf(ACCOUNT_B),
                    NETWORK,
                )
        })

        await waitFor(() => expect(result.current).toBe(true))
    })
})
