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

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { mockInvalidateQueries, mockGetSyncService, networkState } = vi.hoisted(
    () => ({
        mockInvalidateQueries: vi.fn(),
        mockGetSyncService: vi.fn(),
        networkState: { networkId: 'mainnet' },
    }),
)

// Keep the real releaseNetworkScopedQueries — the cache-release tests below
// exercise it — and stub only the sync-service accessor.
vi.mock('@perawallet/wallet-core-background', async importOriginal => {
    const actual = await importOriginal<object>()
    return { ...actual, getSyncService: mockGetSyncService }
})

vi.mock(
    '@perawallet/wallet-core-chain-algorand/blockchain',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@perawallet/wallet-core-chain-algorand/blockchain')
        >()),
    }),
)

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useSelectedScope: (chainId: string) => ({
        chainId,
        networkId: networkState.networkId,
    }),
}))

// The global test setup stubs these packages; the release helper needs the
// real query-key guards for the previous-network cache release.
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual = await importOriginal<object>()
    return { ...actual }
})
vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual = await importOriginal<object>()
    return { ...actual }
})
vi.mock('@perawallet/wallet-core-transactions', async importOriginal => {
    const actual = await importOriginal<object>()
    return { ...actual }
})

import { getAssetsQueryKey } from '@perawallet/wallet-core-assets'
import {
    scopeForLegacyNetwork,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { transactionQueryKeys } from '@perawallet/wallet-core-transactions'
import { useNetworkSwitchInvalidation } from '../useNetworkSwitchInvalidation'

// The hook must act on the client it is rendered under (useQueryClient), not a
// module singleton — the app mounts it inside PersistQueryClientProvider, and
// this fresh-client-per-render setup is the regression guard for that.
const renderWithClient = () => {
    const client = new QueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    return {
        client,
        ...renderHook(() => useNetworkSwitchInvalidation(), { wrapper }),
    }
}

describe('useNetworkSwitchInvalidation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        networkState.networkId = 'mainnet'
        mockGetSyncService.mockReturnValue({
            invalidateQueries: mockInvalidateQueries,
        })
    })

    it('does not invalidate on first mount (cold start)', () => {
        renderWithClient()

        expect(mockInvalidateQueries).not.toHaveBeenCalled()
    })

    it('invalidates exactly once when the network changes', () => {
        const { rerender } = renderWithClient()

        networkState.networkId = 'testnet'
        rerender()

        expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)

        // Unrelated re-renders on the new network don't re-fire.
        rerender()
        expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
    })

    it('swallows an uninitialized sync service', () => {
        mockGetSyncService.mockImplementation(() => {
            throw new Error('not initialized')
        })
        const { rerender } = renderWithClient()

        networkState.networkId = 'testnet'

        expect(() => rerender()).not.toThrow()
    })

    describe('previous-network cache release', () => {
        // On a 10k-asset wallet each DB-backed row query retains a multi-MB
        // hydrated array. With a 1-hour default gcTime, every switch parks the
        // old network's arrays in the cache — the heap ratchets up per switch
        // until GC pauses dominate. SQLite is the source of truth
        // for these, so dropping them on switch loses nothing.

        // Keys derive from each scope; the factories that are public build them.
        const MAINNET = scopeForLegacyNetwork('mainnet')
        const TESTNET = scopeForLegacyNetwork('testnet')
        const balanceKey = (scope: ChainScope) => [
            'accounts',
            'balance',
            { address: 'A1', scope },
        ]
        const departedKeys = [
            balanceKey(MAINNET),
            getAssetsQueryKey(['1'], MAINNET),
            transactionQueryKeys.history('A1', MAINNET),
        ]
        const currentKey = balanceKey(TESTNET)
        const chartKeys = [
            [
                'accounts',
                'balance-history',
                {
                    period: 'one-week',
                    addresses: ['A1'],
                    scope: MAINNET,
                },
            ],
            [
                'assets',
                'prices',
                'history',
                {
                    assetID: '1',
                    period: 'one-week',
                    scope: MAINNET,
                },
            ],
        ]

        const seed = (client: QueryClient) => {
            for (const key of [...departedKeys, currentKey, ...chartKeys]) {
                client.setQueryData(key, ['rows'])
            }
        }

        it("drops the previous scope's DB-backed queries on switch", () => {
            const { client, rerender } = renderWithClient()
            seed(client)

            networkState.networkId = 'testnet'
            rerender()

            for (const key of departedKeys) {
                expect(client.getQueryData(key)).toBeUndefined()
            }
        })

        it("keeps the new scope's queries and persisted chart history", () => {
            const { client, rerender } = renderWithClient()
            seed(client)

            networkState.networkId = 'testnet'
            rerender()

            expect(client.getQueryData(currentKey)).toEqual(['rows'])
            for (const key of chartKeys) {
                expect(client.getQueryData(key)).toEqual(['rows'])
            }
        })
    })
})
