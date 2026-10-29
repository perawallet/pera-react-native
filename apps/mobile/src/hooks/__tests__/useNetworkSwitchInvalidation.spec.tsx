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

const { mockInvalidateQueries, mockGetSyncService, selection } = vi.hoisted(
    () => ({
        mockInvalidateQueries: vi.fn(),
        mockGetSyncService: vi.fn(),
        selection: {
            registeredChainIds: [] as string[],
            networkByChain: {} as Record<string, string>,
        },
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
    // A fresh array every render on purpose: departure is decided by scope key,
    // never by identity.
    useSelectedScopes: (chainIds: readonly string[]) =>
        chainIds.map(chainId => ({
            chainId,
            networkId: selection.networkByChain[chainId],
        })),
}))

// The global test setup stubs accounts and assets; the release helper needs the
// real query-key guards for the previous-network cache release.
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual = await importOriginal<object>()
    return {
        ...actual,
        useRegisteredChainIds: () => selection.registeredChainIds,
    }
})
vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual = await importOriginal<object>()
    return { ...actual }
})

import { getAssetsQueryKey } from '@perawallet/wallet-core-assets'
import {
    type ChainScope,
    LEGACY_CHAIN_ID,
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
        selection.registeredChainIds = ['algorand', 'ethereum']
        selection.networkByChain = { algorand: 'mainnet', ethereum: 'mainnet' }
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

        selection.networkByChain.algorand = 'testnet'
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

        selection.networkByChain.algorand = 'testnet'

        expect(() => rerender()).not.toThrow()
    })

    describe('previous-network cache release', () => {
        // On a 10k-asset wallet each DB-backed row query retains a multi-MB
        // hydrated array. With a 1-hour default gcTime, every switch parks the
        // old network's arrays in the cache — the heap ratchets up per switch
        // until GC pauses dominate. SQLite is the source of truth
        // for these, so dropping them on switch loses nothing.

        // Keys derive from each scope; the factories that are public build them.
        const MAINNET = {
            chainId: LEGACY_CHAIN_ID,
            networkId: 'mainnet',
        } as const
        const TESTNET = {
            chainId: LEGACY_CHAIN_ID,
            networkId: 'testnet',
        } as const
        const ETH_MAINNET = {
            chainId: 'ethereum',
            networkId: 'mainnet',
        } as const
        const ETH_SEPOLIA = {
            chainId: 'ethereum',
            networkId: 'sepolia',
        } as const
        const balanceKey = (scope: ChainScope, address = 'A1') => [
            'accounts',
            'balance',
            { address, scope },
        ]
        const departedKeys = [
            balanceKey(MAINNET),
            getAssetsQueryKey(['1'], MAINNET),
            transactionQueryKeys.history('A1', MAINNET),
        ]
        const ethMainnetKeys = [
            balanceKey(ETH_MAINNET, '0xE1'),
            getAssetsQueryKey(['0xT'], ETH_MAINNET),
            transactionQueryKeys.history('0xE1', ETH_MAINNET),
        ]
        const ethSepoliaKey = balanceKey(ETH_SEPOLIA, '0xE1')
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
            for (const key of [
                ...departedKeys,
                ...ethMainnetKeys,
                ethSepoliaKey,
                currentKey,
                ...chartKeys,
            ]) {
                client.setQueryData(key, ['rows'])
            }
        }

        it("drops the previous scope's DB-backed queries on switch", () => {
            const { client, rerender } = renderWithClient()
            seed(client)

            selection.networkByChain.algorand = 'testnet'
            rerender()

            for (const key of departedKeys) {
                expect(client.getQueryData(key)).toBeUndefined()
            }
        })

        it("keeps the new scope's queries and persisted chart history", () => {
            const { client, rerender } = renderWithClient()
            seed(client)

            selection.networkByChain.algorand = 'testnet'
            rerender()

            expect(client.getQueryData(currentKey)).toEqual(['rows'])
            expect(client.getQueryData(ethMainnetKeys[0])).toEqual(['rows'])
            for (const key of chartKeys) {
                expect(client.getQueryData(key)).toEqual(['rows'])
            }
        })

        describe('two chains', () => {
            it("switching only Ethereum releases Ethereum mainnet's queries and keeps Algorand's", () => {
                const { client, rerender } = renderWithClient()
                seed(client)

                selection.networkByChain.ethereum = 'sepolia'
                rerender()

                for (const key of ethMainnetKeys) {
                    expect(client.getQueryData(key)).toBeUndefined()
                }
                for (const key of [...departedKeys, ethSepoliaKey]) {
                    expect(client.getQueryData(key)).toEqual(['rows'])
                }
                expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
            })

            it('releases every departed scope and invalidates once when both chains switch together', () => {
                const { client, rerender } = renderWithClient()
                seed(client)

                selection.networkByChain.algorand = 'testnet'
                selection.networkByChain.ethereum = 'sepolia'
                rerender()

                for (const key of [...departedKeys, ...ethMainnetKeys]) {
                    expect(client.getQueryData(key)).toBeUndefined()
                }
                expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
            })

            it('releases nothing when a chain registers after mount', () => {
                selection.registeredChainIds = ['algorand']
                const { client, rerender } = renderWithClient()
                seed(client)

                selection.registeredChainIds = ['algorand', 'ethereum']
                rerender()

                for (const key of ethMainnetKeys) {
                    expect(client.getQueryData(key)).toEqual(['rows'])
                }
                expect(mockInvalidateQueries).not.toHaveBeenCalled()
            })

            it('releases a multi-chain holdings key when one of its scopes departs', () => {
                const { client, rerender } = renderWithClient()
                const holdingsKey = [
                    'accounts',
                    'holdings-page',
                    { address: 'A1', scope: MAINNET },
                    { address: '0xE1', scope: ETH_MAINNET },
                    {},
                ]
                client.setQueryData(holdingsKey, ['rows'])
                client.setQueryData(balanceKey(MAINNET), ['rows'])

                selection.networkByChain.ethereum = 'sepolia'
                rerender()

                expect(client.getQueryData(holdingsKey)).toBeUndefined()
                expect(client.getQueryData(balanceKey(MAINNET))).toEqual([
                    'rows',
                ])
            })

            it('still releases on an Ethereum switch when the sync service is not initialized', () => {
                mockGetSyncService.mockImplementation(() => {
                    throw new Error('not initialized')
                })
                const { client, rerender } = renderWithClient()
                seed(client)

                selection.networkByChain.ethereum = 'sepolia'

                expect(() => rerender()).not.toThrow()
                expect(
                    client.getQueryData(balanceKey(ETH_MAINNET, '0xE1')),
                ).toBeUndefined()
            })
        })
    })
})
