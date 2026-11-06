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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useSwapToAssetSelectionList } from '../useSwapToAssetSelectionList'

const mockUseSelectedAccount = vi.hoisted(() => vi.fn())
const mockTrackEvent = vi.hoisted(() => vi.fn())
const mockUseAccountBalancesQuery = vi.hoisted(() => vi.fn())
const mockUseSwapPairsInfiniteQuery = vi.hoisted(() => vi.fn())
const mockGetQueryData = vi.hoisted(() => vi.fn())
const mockSetQueryData = vi.hoisted(() => vi.fn())
const mockUseQueryClient = vi.hoisted(() =>
    vi.fn(() => ({
        getQueryData: mockGetQueryData,
        setQueryData: mockSetQueryData,
    })),
)
const mockGetAssetsQueryKey = vi.hoisted(() =>
    vi.fn(() => ['assets-query-key']),
)

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: mockUseSelectedAccount,
    addressOn: (account: { chains: { algorand?: { address: string } } }) =>
        account.chains.algorand?.address,
    useAccountBalancesQuery: mockUseAccountBalancesQuery,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    getAssetsQueryKey: mockGetAssetsQueryKey,
    PeraAssetVerificationTier: {},
}))

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackEvent: mockTrackEvent,
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: mockUseQueryClient,
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwapPairsInfiniteQuery: mockUseSwapPairsInfiniteQuery,
    scopeOfSwapAsset: ({
        chainId,
        networkId,
    }: {
        chainId: string
        networkId: string
    }) => ({ chainId, networkId }),
}))

const ALGO_SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

const mockDestinationScopes = vi.hoisted(() => ({
    current: [] as { chainId: string; networkId: string }[],
}))
vi.mock('../../../hooks/useSwapDestinationScopes', () => ({
    useSwapDestinationScopes: () => mockDestinationScopes.current,
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        useDebouncedValue: (value: unknown) => value,
    }
})

const mockFetchNextPage = vi.fn()

const mockAvailableAssets = [
    {
        ref: { ...ALGO_SCOPE, assetId: '31566704' },
        assetId: '31566704',
        name: 'USD Coin',
        unitName: 'USDC',
        decimals: 6,
        verificationTier: 'verified',
        logo: 'https://example.com/usdc.png',
    },
    {
        ref: { ...ALGO_SCOPE, assetId: '887406851' },
        assetId: '887406851',
        name: 'Wrapped SOL',
        unitName: 'wSOL',
        decimals: 8,
        verificationTier: 'trusted',
        logo: null,
    },
    {
        ref: { ...ALGO_SCOPE, assetId: '0' },
        assetId: '0',
        name: 'Algo',
        unitName: 'ALGO',
        decimals: 6,
        verificationTier: 'trusted',
        logo: null,
    },
]

const ETH_NATIVE = {
    ref: { ...ETH_SCOPE, assetId: '0' },
    assetId: '0',
    name: 'Ether',
    unitName: 'ETH',
    decimals: 18,
    verificationTier: 'verified',
    logo: null,
}

const mockAssetBalances = [
    { assetId: '31566704', amount: new Decimal('500') },
    { assetId: '0', amount: new Decimal('1000000') },
]

const mockOnAssetSelected = vi.fn()

const defaultParams = {
    scope: ALGO_SCOPE,
    fromAssetId: '31566704',
    onAssetSelected: mockOnAssetSelected,
}

describe('useSwapToAssetSelectionList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockDestinationScopes.current = [ALGO_SCOPE]
        mockGetQueryData.mockReturnValue(undefined)
        mockUseSelectedAccount.mockReturnValue({
            chains: { algorand: { address: 'TEST_ADDRESS' } },
        })
        mockUseAccountBalancesQuery.mockReturnValue({
            accountBalances: new Map([
                ['TEST_ADDRESS', { assetBalances: mockAssetBalances }],
            ]),
        })
        mockUseSwapPairsInfiniteQuery.mockReturnValue({
            assets: mockAvailableAssets,
            isLoading: false,
            hasNextPage: false,
            fetchNextPage: mockFetchNextPage,
        })
    })

    describe('chain filter', () => {
        beforeEach(() => {
            mockDestinationScopes.current = [ALGO_SCOPE, ETH_SCOPE]
        })

        const lastScopes = () =>
            mockUseSwapPairsInfiniteQuery.mock.lastCall?.[0].destinationScopes

        it('has no chips and names no chain for one destination', () => {
            mockDestinationScopes.current = [ALGO_SCOPE]

            const { result } = renderHook(() =>
                useSwapToAssetSelectionList(defaultParams),
            )

            expect(result.current.chainOptions).toEqual([])
            expect(result.current.isChainShown).toBe(false)
        })

        it('searches every destination on All, naming each row', () => {
            const { result } = renderHook(() =>
                useSwapToAssetSelectionList(defaultParams),
            )

            expect(result.current.chainOptions.map(o => o.value)).toEqual([
                null,
                'algorand',
                'ethereum',
            ])
            expect(lastScopes()).toEqual([ALGO_SCOPE, ETH_SCOPE])
            expect(result.current.isChainShown).toBe(true)
        })

        it('narrows the search to the picked chain', () => {
            const { result } = renderHook(() =>
                useSwapToAssetSelectionList(defaultParams),
            )

            act(() => result.current.handleSelectChain('ethereum'))

            expect(result.current.selectedChainId).toBe('ethereum')
            expect(lastScopes()).toEqual([ETH_SCOPE])
            expect(result.current.isChainShown).toBe(false)
            expect(mockTrackEvent).toHaveBeenCalledTimes(1)
        })

        it('returns to All when the picked chain stops being a destination', () => {
            const { result, rerender } = renderHook(() =>
                useSwapToAssetSelectionList(defaultParams),
            )
            act(() => result.current.handleSelectChain('ethereum'))

            mockDestinationScopes.current = [ALGO_SCOPE]
            rerender()

            expect(result.current.selectedChainId).toBeNull()
            expect(lastScopes()).toEqual([ALGO_SCOPE])
        })
    })

    it('returns available assets merged with account balances', () => {
        const { result } = renderHook(() =>
            useSwapToAssetSelectionList(defaultParams),
        )

        expect(result.current.items).toHaveLength(3)

        const usdc = result.current.items.find(
            i => i.swapAsset.assetId === '31566704',
        )
        const wsol = result.current.items.find(
            i => i.swapAsset.assetId === '887406851',
        )
        const algo = result.current.items.find(i => i.swapAsset.assetId === '0')

        expect(usdc?.balance?.toString()).toBe('500')
        expect(wsol?.balance).toBeNull()
        expect(algo?.balance?.toString()).toBe('1000000')
    })

    it('excludes asset when excludeAssetId is provided', () => {
        const { result } = renderHook(() =>
            useSwapToAssetSelectionList({
                ...defaultParams,
                fromAssetId: '887406851',
                excludeAssetId: '31566704',
            }),
        )

        expect(
            result.current.items.every(i => i.swapAsset.assetId !== '31566704'),
        ).toBe(true)
        expect(result.current.items).toHaveLength(2)
    })

    it('asks what the pay asset swaps into, on the scope, with the search text', () => {
        const { result } = renderHook(() =>
            useSwapToAssetSelectionList(defaultParams),
        )

        act(() => {
            result.current.setSearchFilter('USDC')
        })

        expect(mockUseSwapPairsInfiniteQuery).toHaveBeenLastCalledWith({
            anchor: {
                chainId: 'algorand',
                networkId: 'mainnet',
                assetId: '31566704',
            },
            scope: defaultParams.scope,
            destinationScopes: [ALGO_SCOPE],
            q: 'USDC',
        })
    })

    it('sends no search text when the search is empty', () => {
        renderHook(() => useSwapToAssetSelectionList(defaultParams))

        expect(mockUseSwapPairsInfiniteQuery).toHaveBeenLastCalledWith(
            expect.objectContaining({ q: undefined }),
        )
    })

    it('has no anchor to ask about before a pay asset is picked', () => {
        renderHook(() =>
            useSwapToAssetSelectionList({ ...defaultParams, fromAssetId: '' }),
        )

        expect(mockUseSwapPairsInfiniteQuery).toHaveBeenLastCalledWith(
            expect.objectContaining({ anchor: null }),
        )
    })

    it('loads the next page at the end of the list while there is one', () => {
        mockUseSwapPairsInfiniteQuery.mockReturnValue({
            assets: mockAvailableAssets,
            isLoading: false,
            hasNextPage: true,
            fetchNextPage: mockFetchNextPage,
        })
        const { result } = renderHook(() =>
            useSwapToAssetSelectionList(defaultParams),
        )

        act(() => result.current.handleEndReached())

        expect(mockFetchNextPage).toHaveBeenCalledTimes(1)
    })

    it('stops paging after the last page', () => {
        const { result } = renderHook(() =>
            useSwapToAssetSelectionList(defaultParams),
        )

        act(() => result.current.handleEndReached())

        expect(mockFetchNextPage).not.toHaveBeenCalled()
    })

    it('returns empty items when no account is selected', () => {
        mockUseSelectedAccount.mockReturnValue(null)
        mockUseAccountBalancesQuery.mockReturnValue({
            accountBalances: new Map(),
        })

        const { result } = renderHook(() =>
            useSwapToAssetSelectionList(defaultParams),
        )

        // Items are still returned (from API), but all balances are null
        result.current.items.forEach(item => {
            expect(item.balance).toBeNull()
        })
    })

    it('returns empty items when available assets API returns nothing', () => {
        mockUseSwapPairsInfiniteQuery.mockReturnValue({
            assets: [],
            isLoading: false,
            hasNextPage: false,
            fetchNextPage: mockFetchNextPage,
        })

        const { result } = renderHook(() =>
            useSwapToAssetSelectionList(defaultParams),
        )

        expect(result.current.items).toHaveLength(0)
    })

    it('clears search when isVisible becomes false', () => {
        const { result, rerender } = renderHook(
            ({ isVisible }) =>
                useSwapToAssetSelectionList({ ...defaultParams, isVisible }),
            { initialProps: { isVisible: true as Optional<boolean> } },
        )

        act(() => {
            result.current.setSearchFilter('USDC')
        })

        expect(result.current.searchFilter).toBe('USDC')

        rerender({ isVisible: false })

        expect(result.current.searchFilter).toBe('')
    })

    it('exposes isLoading from the query', () => {
        mockUseSwapPairsInfiniteQuery.mockReturnValue({
            assets: [],
            isLoading: true,
            hasNextPage: false,
            fetchNextPage: mockFetchNextPage,
        })

        const { result } = renderHook(() =>
            useSwapToAssetSelectionList(defaultParams),
        )

        expect(result.current.isLoading).toBe(true)
    })

    describe('handleAssetSelected', () => {
        it('calls onAssetSelected with normalised asset data', () => {
            const { result } = renderHook(() =>
                useSwapToAssetSelectionList(defaultParams),
            )
            const usdc = result.current.items.find(
                i => i.swapAsset.assetId === '31566704',
            )!

            act(() => {
                result.current.handleAssetSelected(usdc)
            })

            expect(mockOnAssetSelected).toHaveBeenCalledWith(
                {
                    assetId: '31566704',
                    amount: new Decimal('500'),
                    nativeValue: null,
                    fiatValue: null,
                    restriction: null,
                },
                ALGO_SCOPE,
            )
        })

        it('passes the scope of an asset on another chain, unbalanced and cached there', () => {
            mockDestinationScopes.current = [ALGO_SCOPE, ETH_SCOPE]
            mockUseSwapPairsInfiniteQuery.mockReturnValue({
                assets: [...mockAvailableAssets, ETH_NATIVE],
                isLoading: false,
                hasNextPage: false,
                fetchNextPage: mockFetchNextPage,
            })
            const { result } = renderHook(() =>
                useSwapToAssetSelectionList(defaultParams),
            )
            const eth = result.current.items.find(
                i => i.swapAsset.unitName === 'ETH',
            )!

            act(() => {
                result.current.handleAssetSelected(eth)
            })

            // ALGO shares the id '0' and has a balance; it isn't this asset's.
            expect(eth.balance).toBeNull()
            expect(mockGetAssetsQueryKey).toHaveBeenCalledWith(
                ['0'],
                ETH_SCOPE,
                { fetchMissing: true },
            )
            expect(mockOnAssetSelected).toHaveBeenCalledWith(
                expect.objectContaining({ assetId: '0' }),
                ETH_SCOPE,
            )
        })

        it('seeds the query cache when the asset is not already cached', () => {
            mockGetQueryData.mockReturnValue(undefined)

            const { result } = renderHook(() =>
                useSwapToAssetSelectionList(defaultParams),
            )
            const usdc = result.current.items.find(
                i => i.swapAsset.assetId === '31566704',
            )!

            act(() => {
                result.current.handleAssetSelected(usdc)
            })

            expect(mockSetQueryData).toHaveBeenCalledOnce()
            expect(mockGetAssetsQueryKey).toHaveBeenCalledWith(
                ['31566704'],
                defaultParams.scope,
                { fetchMissing: true },
            )
        })

        it('seeds the query cache when the cached entry is an empty array', () => {
            // An [] entry never refetches (staleTime Infinity); treating it as
            // "already cached" left the selection permanently unrendered.
            mockGetQueryData.mockReturnValue([])

            const { result } = renderHook(() =>
                useSwapToAssetSelectionList(defaultParams),
            )
            const usdc = result.current.items.find(
                i => i.swapAsset.assetId === '31566704',
            )!

            act(() => {
                result.current.handleAssetSelected(usdc)
            })

            expect(mockSetQueryData).toHaveBeenCalledOnce()
        })

        it("adds the router's logo to a cached asset that has none", () => {
            mockGetQueryData.mockReturnValue([
                {
                    assetId: '31566704',
                    decimals: 6,
                    peraMetadata: {
                        isDeleted: false,
                        verificationTier: 'verified',
                        logo: null,
                    },
                },
            ])

            const { result } = renderHook(() =>
                useSwapToAssetSelectionList(defaultParams),
            )
            const usdc = result.current.items.find(
                i => i.swapAsset.assetId === '31566704',
            )!

            act(() => {
                result.current.handleAssetSelected(usdc)
            })

            expect(mockSetQueryData).toHaveBeenCalledWith(
                ['assets-query-key'],
                [
                    expect.objectContaining({
                        decimals: 6,
                        peraMetadata: expect.objectContaining({
                            logo: 'https://example.com/usdc.png',
                        }),
                    }),
                ],
            )
        })

        it('does not seed the query cache when the asset is already cached with a logo', () => {
            mockGetQueryData.mockReturnValue([
                {
                    assetId: '31566704',
                    peraMetadata: {
                        isDeleted: false,
                        verificationTier: 'verified',
                        logo: 'https://cached/usdc.png',
                    },
                },
            ])

            const { result } = renderHook(() =>
                useSwapToAssetSelectionList(defaultParams),
            )
            const usdc = result.current.items.find(
                i => i.swapAsset.assetId === '31566704',
            )!

            act(() => {
                result.current.handleAssetSelected(usdc)
            })

            expect(mockSetQueryData).not.toHaveBeenCalled()
        })

        it('uses zero balance when asset is not owned', () => {
            const { result } = renderHook(() =>
                useSwapToAssetSelectionList(defaultParams),
            )
            const wsol = result.current.items.find(
                i => i.swapAsset.assetId === '887406851',
            )!

            act(() => {
                result.current.handleAssetSelected(wsol)
            })

            expect(mockOnAssetSelected).toHaveBeenCalledWith(
                expect.objectContaining({ amount: new Decimal(0) }),
                ALGO_SCOPE,
            )
        })
    })
})
