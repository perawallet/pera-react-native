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
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { seedAuthority } from '@test-utils/algorandAccountsAdapter'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
    seedAlgorandAccountState,
} from '@test-utils/database-setup'
import {
    insertAssetHolding,
    invalidateAccountQueriesForAddresses,
    refreshAccountHoldings,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useShouldPromptMnemonicBackup } from '@perawallet/wallet-core-backup'
import { useKMS } from '@perawallet/wallet-core-kms'
import {
    useNetworkStore,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import { type LegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'
import { addressOf } from './__fixtures__/accounts'
import { ALGO25_TEST_MNEMONIC_INDICES } from './__fixtures__/onboarding'

const TESTNET_SCOPE = {
    chainId: ALGORAND_CHAIN_ID,
    networkId: 'testnet',
} as const

const NETWORK = 'mainnet' as const

const ACCOUNT_A: WalletAccount = {
    id: 'reactivity-a',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: 'A'.repeat(58), keyPairId: 'reactivity-a-key' },
    },
    name: 'Funder',
}

// Backup state is keyed by an account's seed, so the account needs a real
// key in the keystore to be promptable at all.
let accountB: WalletAccount

const mintNeedsBackupAccount = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let signKeyId = ''
    await act(async () => {
        const key = await kms.current.createAlgo25Key({
            mnemonicIndices: ALGO25_TEST_MNEMONIC_INDICES,
        })
        signKeyId = key.signKeyId
    })
    return {
        id: 'reactivity-b',
        custody: { kind: 'local', seed: null },
        chains: {
            algorand: { address: 'B'.repeat(58), keyPairId: signKeyId },
        },
        name: 'Needs backup',
    }
}

const seedUnfunded = async (
    address: string,
    network: LegacyNetwork = NETWORK,
) => {
    await seedAlgorandAccountState({
        accountAddress: address,
        scope: { chainId: ALGORAND_CHAIN_ID, networkId: network } as const,
        nativeBalance: new Decimal(0),
        minBalance: new Decimal(100_000),
    })
    await insertAssetHolding({
        accountAddress: address,
        assetId: '0',
        scope: { chainId: ALGORAND_CHAIN_ID, networkId: network } as const,
        amount: new Decimal(0),
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
        resetTestKeystore()
        accountB = await mintNeedsBackupAccount()
        useAccountsStore.getState().setAccounts([ACCOUNT_A, accountB])
    })

    it('Given an unfunded never-backed-up account, when its ALGO holding is refreshed and account queries invalidated (the post-send path), then the prompt flips to true', async () => {
        await seedUnfunded(addressOf(accountB))

        const queryClient = createTestQueryClient()
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )

        const { result } = renderHook(
            () =>
                useShouldPromptMnemonicBackup(
                    accountB,
                    useSelectedScope(ALGORAND_CHAIN_ID),
                ),
            { wrapper },
        )

        await waitFor(() => expect(result.current).toBe(false))

        // What SyncService.refreshAccounts does after the send confirms:
        // persist fresh chain state, then invalidate the account's queries.
        await act(async () => {
            await refreshAccountHoldings({
                accountAddress: addressOf(accountB),
                scope: {
                    chainId: ALGORAND_CHAIN_ID,
                    networkId: NETWORK,
                } as const,
                holdings: [
                    {
                        assetId: '0',
                        amount: new Decimal(5_000_000),
                    },
                ],
            })
            invalidateAccountQueriesForAddresses(queryClient, [
                addressOf(accountB),
            ])
        })

        await waitFor(() => expect(result.current).toBe(true))
    })

    it('Given an account funded only on testnet, when mainnet is the selected network, then the prompt is still true', async () => {
        await seedUnfunded(addressOf(accountB))
        await seedUnfunded(addressOf(accountB), 'testnet')
        await refreshAccountHoldings({
            accountAddress: addressOf(accountB),
            scope: TESTNET_SCOPE,
            holdings: [
                {
                    assetId: '0',
                    amount: new Decimal(5_000_000),
                },
            ],
        })
        useNetworkStore.getState().setMode('live')

        const queryClient = createTestQueryClient()
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )

        const { result } = renderHook(
            () =>
                useShouldPromptMnemonicBackup(
                    accountB,
                    useSelectedScope(ALGORAND_CHAIN_ID),
                ),
            { wrapper },
        )

        await waitFor(() => expect(result.current).toBe(true))
    })

    it('Given an unfunded never-backed-up account, when another account is rekeyed to it (store update from the post-confirmation account fetch), then the prompt flips to true', async () => {
        await seedUnfunded(addressOf(accountB))

        const queryClient = createTestQueryClient()
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )

        const { result } = renderHook(
            () =>
                useShouldPromptMnemonicBackup(
                    accountB,
                    useSelectedScope(ALGORAND_CHAIN_ID),
                ),
            { wrapper },
        )

        await waitFor(() => expect(result.current).toBe(false))

        // What fetchAndPersistAccount does when it sees the new auth-addr.
        act(() => {
            seedAuthority(addressOf(ACCOUNT_A), addressOf(accountB), {
                chainId: ALGORAND_CHAIN_ID,
                networkId: NETWORK,
            } as const)
        })

        await waitFor(() => expect(result.current).toBe(true))
    })
})
