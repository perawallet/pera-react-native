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
        networkState: { network: 'mainnet' },
    }),
)

// Keep the real releaseNetworkScopedQueries — the cache-release tests below
// exercise it — and stub only the sync-service accessor.
vi.mock('@perawallet/wallet-core-background', async importOriginal => {
    const actual = await importOriginal<object>()
    return { ...actual, getSyncService: mockGetSyncService }
})

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual = await importOriginal<object>()
    return {
        ...actual,
        useNetwork: () => ({ network: networkState.network }),
    }
})

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
        networkState.network = 'mainnet'
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

        networkState.network = 'testnet'
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

        networkState.network = 'testnet'

        expect(() => rerender()).not.toThrow()
    })

    describe('previous-network cache release', () => {
        // On a 10k-asset wallet each DB-backed row query retains a multi-MB
        // hydrated array. With a 1-hour default gcTime, every switch parks the
        // old network's arrays in the cache — the heap ratchets up per switch
        // until GC pauses dominate. SQLite is the source of truth
        // for these, so dropping them on switch loses nothing.
        const seed = (client: QueryClient) => {
            client.setQueryData(
                ['accounts', 'balance', { address: 'A1', network: 'mainnet' }],
                { holdings: ['big'] },
            )
            client.setQueryData(
                ['assets', { assetIDs: 'h', network: 'mainnet' }],
                ['rows'],
            )
            client.setQueryData(
                [
                    'transactions',
                    'history',
                    { accountAddress: 'A1', network: 'mainnet' },
                ],
                ['txs'],
            )
            client.setQueryData(
                ['accounts', 'balance', { address: 'A1', network: 'testnet' }],
                { holdings: ['keep'] },
            )
            client.setQueryData(
                [
                    'accounts',
                    'balance-history',
                    { period: '1W', addresses: ['A1'], network: 'mainnet' },
                ],
                ['chart'],
            )
        }

        it("drops the previous network's DB-backed queries on switch", () => {
            const { client, rerender } = renderWithClient()
            seed(client)

            networkState.network = 'testnet'
            rerender()

            expect(
                client.getQueryData([
                    'accounts',
                    'balance',
                    { address: 'A1', network: 'mainnet' },
                ]),
            ).toBeUndefined()
            expect(
                client.getQueryData([
                    'assets',
                    { assetIDs: 'h', network: 'mainnet' },
                ]),
            ).toBeUndefined()
            expect(
                client.getQueryData([
                    'transactions',
                    'history',
                    { accountAddress: 'A1', network: 'mainnet' },
                ]),
            ).toBeUndefined()
        })

        it("keeps the new network's queries and persisted chart history", () => {
            const { client, rerender } = renderWithClient()
            seed(client)

            networkState.network = 'testnet'
            rerender()

            expect(
                client.getQueryData([
                    'accounts',
                    'balance',
                    { address: 'A1', network: 'testnet' },
                ]),
            ).toEqual({ holdings: ['keep'] })
            expect(
                client.getQueryData([
                    'accounts',
                    'balance-history',
                    { period: '1W', addresses: ['A1'], network: 'mainnet' },
                ]),
            ).toEqual(['chart'])
        })
    })
})
