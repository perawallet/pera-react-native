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

// Network selection through `useNetwork`: `setNetwork` updates the persisted
// store, `networkConfig` re-derives algod/indexer URLs, and every consumer
// re-keys against the new network on the next render.
//
// The point is the contract that hooks consume `useNetwork` rather than
// hardcoding URLs — a custom-algod-URL feature would extend this same surface.

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
    upsertAccountBalance,
    useAccountBalancesQuery,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { Networks } from '@perawallet/wallet-core-shared'

import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000

const SAME_ADDRESS_ACCOUNT: WalletAccount = {
    id: 'multi-network',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'multi-network-key',
    name: 'Multi-network Account',
}

const buildWrapper = () => {
    const queryClient = createTestQueryClient()
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

describe('Flow: Settings → Network selection', () => {
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
        // Seed ALGO into both networks' asset tables so balance lookups
        // resolve cleanly when the test toggles between them.
        await seedAlgoAsset('mainnet')
        await seedAlgoAsset('testnet')

        useAccountsStore.getState().setAccounts([SAME_ADDRESS_ACCOUNT])
        useAccountsStore
            .getState()
            .setSelectedAccountAddress(SAME_ADDRESS_ACCOUNT.address)
        // Reset network to a known starting point so each test isn't
        // contaminated by the persisted setting from a prior test.
        renderHook(() => useNetwork()).result.current.setNetwork(
            Networks.mainnet,
        )
    })

    it(
        'Given the user is on mainnet, when setNetwork(testnet) runs, then the network state flips and the network config exposes the testnet algod URL',
        async () => {
            const { result } = renderHook(() => useNetwork())

            await waitFor(() => {
                expect(result.current.network).toBe(Networks.mainnet)
            })
            const mainnetAlgodUrl = result.current.networkConfig.algodUrl
            const mainnetIndexerUrl = result.current.networkConfig.indexerUrl
            expect(result.current.isMainnet).toBe(true)
            expect(result.current.isTestnet).toBe(false)

            act(() => {
                result.current.setNetwork(Networks.testnet)
            })

            await waitFor(() => {
                expect(result.current.network).toBe(Networks.testnet)
            })
            // Production hooks key off `network` for query keys + URL
            // resolution; the derived flags must flip too.
            expect(result.current.isMainnet).toBe(false)
            expect(result.current.isTestnet).toBe(true)

            // Critical: the algod / indexer URLs differ between
            // networks. A regression that returns the same URL for both
            // would silently pin every "testnet" request to mainnet
            // (or vice-versa) — exactly the kind of cross-environment
            // bug a user would hit in seconds.
            expect(result.current.networkConfig.algodUrl).not.toBe(
                mainnetAlgodUrl,
            )
            expect(result.current.networkConfig.indexerUrl).not.toBe(
                mainnetIndexerUrl,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the same address has separate balances seeded into mainnet and testnet rows, when the network toggles, then useAccountBalancesQuery returns the per-network balance (proves consumers re-key on network change)',
        async () => {
            // Seed two distinct algo balances for the same address —
            // one per network. Production-side this is what happens
            // after a sync against mainnet vs testnet algod. The
            // assertion is "switching network changes which row the
            // hook reads".
            await upsertAccountBalance({
                accountAddress: SAME_ADDRESS_ACCOUNT.address,
                network: 'mainnet',
                algoBalance: new Decimal(100_000_000), // 100 ALGO mainnet
                totalAssetsOptedIn: 0,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                minBalance: new Decimal(100_000),
                status: 'Offline',
                authAddress: null,
            })
            await upsertAccountBalance({
                accountAddress: SAME_ADDRESS_ACCOUNT.address,
                network: 'testnet',
                algoBalance: new Decimal(7_000_000), // 7 ALGO testnet
                totalAssetsOptedIn: 0,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                minBalance: new Decimal(100_000),
                status: 'Offline',
                authAddress: null,
            })

            // ALGO is a regular holding row now; the balance hook reads it from
            // the per-network holdings table (base units / microalgos), so seed
            // the native balance there too — one row per network.
            await insertAssetHolding({
                accountAddress: SAME_ADDRESS_ACCOUNT.address,
                assetId: '0',
                network: 'mainnet',
                amount: '100000000', // 100 ALGO
            })
            await insertAssetHolding({
                accountAddress: SAME_ADDRESS_ACCOUNT.address,
                assetId: '0',
                network: 'testnet',
                amount: '7000000', // 7 ALGO
            })

            // Compose `useNetwork` + `useAccountBalancesQuery` in one
            // hook so they share the same render lifecycle. Toggling
            // `setNetwork` should make the balance query re-key off the
            // new network and read the testnet row.
            const { result } = renderHook(
                () => {
                    const net = useNetwork()
                    const balances = useAccountBalancesQuery(
                        [SAME_ADDRESS_ACCOUNT],
                        true,
                    )
                    return { net, balances }
                },
                { wrapper: buildWrapper() },
            )

            // Mainnet first.
            await waitFor(
                () => {
                    expect(result.current.balances.isPending).toBe(false)
                    const balance = result.current.balances.accountBalances.get(
                        SAME_ADDRESS_ACCOUNT.address,
                    )
                    const algo = balance?.assetBalances.find(
                        b => b.assetId === '0',
                    )
                    // 100 ALGO in display units (base units / 10^6).
                    expect(algo?.amount.toString()).toBe('100')
                },
                { timeout: 5000 },
            )

            // Toggle to testnet — the query re-keys and reads the
            // testnet row.
            act(() => {
                result.current.net.setNetwork(Networks.testnet)
            })

            await waitFor(
                () => {
                    const balance = result.current.balances.accountBalances.get(
                        SAME_ADDRESS_ACCOUNT.address,
                    )
                    const algo = balance?.assetBalances.find(
                        b => b.assetId === '0',
                    )
                    // 7 ALGO in display units — proves the new network's row
                    // is being read, not the cached mainnet result.
                    expect(algo?.amount.toString()).toBe('7')
                },
                { timeout: 5000 },
            )

            // Toggle back: original mainnet figure resurfaces (no
            // accidental write through to the wrong network).
            act(() => {
                result.current.net.setNetwork(Networks.mainnet)
            })
            await waitFor(
                () => {
                    const balance = result.current.balances.accountBalances.get(
                        SAME_ADDRESS_ACCOUNT.address,
                    )
                    const algo = balance?.assetBalances.find(
                        b => b.assetId === '0',
                    )
                    expect(algo?.amount.toString()).toBe('100')
                },
                { timeout: 5000 },
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
