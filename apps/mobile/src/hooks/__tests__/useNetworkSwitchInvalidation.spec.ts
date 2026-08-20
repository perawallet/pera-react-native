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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const { mockInvalidateQueries, mockGetSyncService, networkState } = vi.hoisted(
    () => ({
        mockInvalidateQueries: vi.fn(),
        mockGetSyncService: vi.fn(),
        networkState: { network: 'mainnet' },
    }),
)

vi.mock('@perawallet/wallet-core-background', () => ({
    getSyncService: mockGetSyncService,
}))

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual = await importOriginal<object>()
    return {
        ...actual,
        useNetwork: () => ({ network: networkState.network }),
    }
})

// The global test setup stubs these packages; the hook needs the real query-key
// guards for the previous-network cache release.
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
import { queryClient } from '../../providers/queryClient'

describe('useNetworkSwitchInvalidation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        queryClient.clear()
        networkState.network = 'mainnet'
        mockGetSyncService.mockReturnValue({
            invalidateQueries: mockInvalidateQueries,
        })
    })

    it('does not invalidate on first mount (cold start)', () => {
        renderHook(() => useNetworkSwitchInvalidation())

        expect(mockInvalidateQueries).not.toHaveBeenCalled()
    })

    it('invalidates exactly once when the network changes', () => {
        const { rerender } = renderHook(() => useNetworkSwitchInvalidation())

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
        const { rerender } = renderHook(() => useNetworkSwitchInvalidation())

        networkState.network = 'testnet'

        expect(() => rerender()).not.toThrow()
    })

    describe('previous-network cache release', () => {
        // On a 10k-asset wallet each DB-backed row query retains a multi-MB
        // hydrated array. With a 1-hour default gcTime, every switch parks the
        // old network's arrays in the cache — the heap ratchets up per switch
        // until GC pauses dominate (PERA-4953). SQLite is the source of truth
        // for these, so dropping them on switch loses nothing.
        const seed = () => {
            queryClient.setQueryData(
                ['accounts', 'balance', { address: 'A1', network: 'mainnet' }],
                { holdings: ['big'] },
            )
            queryClient.setQueryData(
                ['assets', { assetIDs: 'h', network: 'mainnet' }],
                ['rows'],
            )
            queryClient.setQueryData(
                [
                    'transactions',
                    'history',
                    { accountAddress: 'A1', network: 'mainnet' },
                ],
                ['txs'],
            )
            queryClient.setQueryData(
                ['accounts', 'balance', { address: 'A1', network: 'testnet' }],
                { holdings: ['keep'] },
            )
            queryClient.setQueryData(
                [
                    'accounts',
                    'balance-history',
                    { period: '1W', addresses: ['A1'], network: 'mainnet' },
                ],
                ['chart'],
            )
        }

        it("drops the previous network's DB-backed queries on switch", () => {
            seed()
            const { rerender } = renderHook(() =>
                useNetworkSwitchInvalidation(),
            )

            networkState.network = 'testnet'
            rerender()

            expect(
                queryClient.getQueryData([
                    'accounts',
                    'balance',
                    { address: 'A1', network: 'mainnet' },
                ]),
            ).toBeUndefined()
            expect(
                queryClient.getQueryData([
                    'assets',
                    { assetIDs: 'h', network: 'mainnet' },
                ]),
            ).toBeUndefined()
            expect(
                queryClient.getQueryData([
                    'transactions',
                    'history',
                    { accountAddress: 'A1', network: 'mainnet' },
                ]),
            ).toBeUndefined()
        })

        it("keeps the new network's queries and persisted chart history", () => {
            seed()
            const { rerender } = renderHook(() =>
                useNetworkSwitchInvalidation(),
            )

            networkState.network = 'testnet'
            rerender()

            expect(
                queryClient.getQueryData([
                    'accounts',
                    'balance',
                    { address: 'A1', network: 'testnet' },
                ]),
            ).toEqual({ holdings: ['keep'] })
            expect(
                queryClient.getQueryData([
                    'accounts',
                    'balance-history',
                    { period: '1W', addresses: ['A1'], network: 'mainnet' },
                ]),
            ).toEqual(['chart'])
        })
    })
})
