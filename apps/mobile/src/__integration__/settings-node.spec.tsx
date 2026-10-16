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

// Network selection through the network store: switching the wallet mode
// moves the selected scope, `getAlgorandChainConfig` re-derives algod/indexer
// URLs from it, and every consumer re-keys against the new scope on the next
// render.
//
// The point is the contract that hooks consume the selected scope rather than
// hardcoding URLs — a custom-algod-URL feature would extend this same surface.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import { act, renderHook, waitFor } from '@testing-library/react'

import {
    useNetworkStore,
    useSelectedScope,
    useWalletDeployment,
} from '@perawallet/wallet-core-chain-shared'
import { getAlgorandChainConfig } from '@perawallet/wallet-core-config'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { createQueryClientWrapper } from '@test-utils/render'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
    seedAlgorandAccountState,
} from '@test-utils/database-setup'
import {
    insertAssetHolding,
    useAccountBalancesQuery,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'
import { addressOf } from './__fixtures__/accounts'

const MAINNET_SCOPE = {
    chainId: LEGACY_CHAIN_ID,
    networkId: 'mainnet',
} as const
const TESTNET_SCOPE = {
    chainId: LEGACY_CHAIN_ID,
    networkId: 'testnet',
} as const

const SAME_ADDRESS_ACCOUNT: WalletAccount = {
    id: 'multi-network',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: {
            address: ALGO25_TEST_ADDRESS,
            keyPairId: 'multi-network-key',
        },
    },
    name: 'Multi-network Account',
}

describe('Flow: Settings → Network selection', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        // Seed ALGO into both networks' asset tables so balance lookups
        // resolve cleanly when the test toggles between them.
        await seedAlgoAsset('mainnet')
        await seedAlgoAsset('testnet')

        useAccountsStore.getState().setAccounts([SAME_ADDRESS_ACCOUNT])
        useAccountsStore
            .getState()
            .setSelectedAccountId(SAME_ADDRESS_ACCOUNT.id)
        // Reset network to a known starting point so each test isn't
        // contaminated by the persisted setting from a prior test.
        useNetworkStore.getState().resetState()
    })

    it('Given the user is on mainnet, when the mode flips to developer, then the selected scope moves to testnet and the chain config exposes the testnet algod URL', async () => {
        const { result } = renderHook(() => ({
            scope: useSelectedScope(LEGACY_CHAIN_ID),
            deployment: useWalletDeployment(),
        }))

        await waitFor(() => {
            expect(result.current.scope.networkId).toBe('mainnet')
        })
        const mainnetConfig = getAlgorandChainConfig(result.current.scope)
        expect(result.current.deployment).toBe('live')

        act(() => {
            useNetworkStore.getState().setMode('developer')
        })

        await waitFor(() => {
            expect(result.current.scope.networkId).toBe('testnet')
        })
        expect(result.current.deployment).toBe('developer')

        // Critical: the algod / indexer URLs differ between
        // networks. A regression that returns the same URL for both
        // would silently pin every "testnet" request to mainnet
        // (or vice-versa) — exactly the kind of cross-environment
        // bug a user would hit in seconds.
        const testnetConfig = getAlgorandChainConfig(result.current.scope)
        expect(testnetConfig.algodUrl).not.toBe(mainnetConfig.algodUrl)
        expect(testnetConfig.indexerUrl).not.toBe(mainnetConfig.indexerUrl)
    })

    it('Given the same address has separate balances seeded into mainnet and testnet rows, when the network toggles, then useAccountBalancesQuery returns the per-network balance (proves consumers re-key on network change)', async () => {
        // Seed two distinct algo balances for the same address —
        // one per network. Production-side this is what happens
        // after a sync against mainnet vs testnet algod. The
        // assertion is "switching network changes which row the
        // hook reads".
        await seedAlgorandAccountState({
            accountAddress: addressOf(SAME_ADDRESS_ACCOUNT),
            scope: MAINNET_SCOPE,
            nativeBalance: new Decimal(100_000_000), // 100 ALGO mainnet
            minBalance: new Decimal(100_000),
        })
        await seedAlgorandAccountState({
            accountAddress: addressOf(SAME_ADDRESS_ACCOUNT),
            scope: TESTNET_SCOPE,
            nativeBalance: new Decimal(7_000_000), // 7 ALGO testnet
            minBalance: new Decimal(100_000),
        })

        // ALGO is a regular holding row now; the balance hook reads it from
        // the per-network holdings table (base units / microalgos), so seed
        // the native balance there too — one row per network.
        await insertAssetHolding({
            accountAddress: addressOf(SAME_ADDRESS_ACCOUNT),
            assetId: '0',
            scope: MAINNET_SCOPE,
            amount: new Decimal('100000000'), // 100 ALGO
        })
        await insertAssetHolding({
            accountAddress: addressOf(SAME_ADDRESS_ACCOUNT),
            assetId: '0',
            scope: TESTNET_SCOPE,
            amount: new Decimal('7000000'), // 7 ALGO
        })

        // Compose the selected scope + `useAccountBalancesQuery` in one
        // hook so they share the same render lifecycle. Flipping the mode
        // should make the balance query re-key off the new network and read
        // the testnet row.
        const { result } = renderHook(
            () => {
                const scope = useSelectedScope(LEGACY_CHAIN_ID)
                const balances = useAccountBalancesQuery(
                    [SAME_ADDRESS_ACCOUNT],
                    scope,
                    true,
                )
                return { balances }
            },
            { wrapper: createQueryClientWrapper() },
        )

        // Mainnet first.
        await waitFor(
            () => {
                expect(result.current.balances.isPending).toBe(false)
                const balance = result.current.balances.accountBalances.get(
                    addressOf(SAME_ADDRESS_ACCOUNT),
                )
                const algo = balance?.assetBalances.find(b => b.assetId === '0')
                // 100 ALGO in display units (base units / 10^6).
                expect(algo?.amount.toString()).toBe('100')
            },
            { timeout: 5000 },
        )

        // Toggle to testnet — the query re-keys and reads the
        // testnet row.
        act(() => {
            useNetworkStore.getState().setMode('developer')
        })

        await waitFor(
            () => {
                const balance = result.current.balances.accountBalances.get(
                    addressOf(SAME_ADDRESS_ACCOUNT),
                )
                const algo = balance?.assetBalances.find(b => b.assetId === '0')
                // 7 ALGO in display units — proves the new network's row
                // is being read, not the cached mainnet result.
                expect(algo?.amount.toString()).toBe('7')
            },
            { timeout: 5000 },
        )

        // Toggle back: original mainnet figure resurfaces (no
        // accidental write through to the wrong network).
        act(() => {
            useNetworkStore.getState().setMode('live')
        })
        await waitFor(
            () => {
                const balance = result.current.balances.accountBalances.get(
                    addressOf(SAME_ADDRESS_ACCOUNT),
                )
                const algo = balance?.assetBalances.find(b => b.assetId === '0')
                expect(algo?.amount.toString()).toBe('100')
            },
            { timeout: 5000 },
        )
    })
})
