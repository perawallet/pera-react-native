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
const mockUseAccountBalancesQuery = vi.hoisted(() => vi.fn())
const mockUseAvailableAssetsQuery = vi.hoisted(() => vi.fn())
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
    useAccountBalancesQuery: mockUseAccountBalancesQuery,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    getAssetsQueryKey: mockGetAssetsQueryKey,
    PeraAssetVerificationTier: {},
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn(() => ({ network: 'mainnet' })),
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: mockUseQueryClient,
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useAvailableAssetsQuery: mockUseAvailableAssetsQuery,
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

const mockAvailableAssets = [
    {
        assetId: '31566704',
        name: 'USD Coin',
        unitName: 'USDC',
        decimals: 6,
        verificationTier: 'verified',
        logo: 'https://example.com/usdc.png',
    },
    {
        assetId: '887406851',
        name: 'Wrapped SOL',
        unitName: 'wSOL',
        decimals: 8,
        verificationTier: 'trusted',
        logo: null,
    },
    {
        assetId: '0',
        name: 'Algo',
        unitName: 'ALGO',
        decimals: 6,
        verificationTier: 'trusted',
        logo: null,
    },
]

const mockAssetBalances = [
    { assetId: '31566704', amount: new Decimal('500') },
    { assetId: '0', amount: new Decimal('1000000') },
]

const mockOnAssetSelected = vi.fn()

const defaultParams = {
    fromAssetId: '31566704',
    onAssetSelected: mockOnAssetSelected,
}

describe('useSwapToAssetSelectionList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetQueryData.mockReturnValue(undefined)
        mockUseSelectedAccount.mockReturnValue({ address: 'TEST_ADDRESS' })
        mockUseAccountBalancesQuery.mockReturnValue({
            accountBalances: new Map([
                ['TEST_ADDRESS', { assetBalances: mockAssetBalances }],
            ]),
        })
        mockUseAvailableAssetsQuery.mockReturnValue({
            data: mockAvailableAssets,
            isLoading: false,
        })
    })

    it('returns available assets merged with account balances', () => {
        const { result } = renderHook(() =>
            useSwapToAssetSelectionList(defaultParams),
        )

        expect(result.current.items).toHaveLength(3)

        const usdc = result.current.items.find(
            i => i.dexAsset.assetId === '31566704',
        )
        const wsol = result.current.items.find(
            i => i.dexAsset.assetId === '887406851',
        )
        const algo = result.current.items.find(i => i.dexAsset.assetId === '0')

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
            result.current.items.every(i => i.dexAsset.assetId !== '31566704'),
        ).toBe(true)
        expect(result.current.items).toHaveLength(2)
    })

    it('passes search query to useAvailableAssetsQuery', () => {
        const { result } = renderHook(() =>
            useSwapToAssetSelectionList(defaultParams),
        )

        act(() => {
            result.current.setSearchFilter('USDC')
        })

        expect(mockUseAvailableAssetsQuery).toHaveBeenCalledWith(
            31_566_704,
            'USDC',
            true,
        )
    })

    it('passes undefined as query when search is empty', () => {
        renderHook(() => useSwapToAssetSelectionList(defaultParams))

        expect(mockUseAvailableAssetsQuery).toHaveBeenCalledWith(
            31_566_704,
            undefined,
            true,
        )
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
        mockUseAvailableAssetsQuery.mockReturnValue({
            data: [],
            isLoading: false,
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
        mockUseAvailableAssetsQuery.mockReturnValue({
            data: undefined,
            isLoading: true,
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
                i => i.dexAsset.assetId === '31566704',
            )!

            act(() => {
                result.current.handleAssetSelected(usdc)
            })

            expect(mockOnAssetSelected).toHaveBeenCalledWith({
                assetId: '31566704',
                amount: new Decimal('500'),
                algoValue: new Decimal(0),
                isFrozen: false,
            })
        })

        it('seeds the query cache when the asset is not already cached', () => {
            mockGetQueryData.mockReturnValue(undefined)

            const { result } = renderHook(() =>
                useSwapToAssetSelectionList(defaultParams),
            )
            const usdc = result.current.items.find(
                i => i.dexAsset.assetId === '31566704',
            )!

            act(() => {
                result.current.handleAssetSelected(usdc)
            })

            expect(mockSetQueryData).toHaveBeenCalledOnce()
        })

        it('seeds the query cache when the cached entry is an empty array', () => {
            // A DB-only useAssetsQuery for an unheld asset caches [] with
            // staleTime Infinity; treating that as "already cached" made the
            // default USDC receive asset permanently unselectable.
            mockGetQueryData.mockReturnValue([])

            const { result } = renderHook(() =>
                useSwapToAssetSelectionList(defaultParams),
            )
            const usdc = result.current.items.find(
                i => i.dexAsset.assetId === '31566704',
            )!

            act(() => {
                result.current.handleAssetSelected(usdc)
            })

            expect(mockSetQueryData).toHaveBeenCalledOnce()
        })

        it('does not seed the query cache when the asset is already cached', () => {
            mockGetQueryData.mockReturnValue([{ assetId: '31566704' }])

            const { result } = renderHook(() =>
                useSwapToAssetSelectionList(defaultParams),
            )
            const usdc = result.current.items.find(
                i => i.dexAsset.assetId === '31566704',
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
                i => i.dexAsset.assetId === '887406851',
            )!

            act(() => {
                result.current.handleAssetSelected(wsol)
            })

            expect(mockOnAssetSelected).toHaveBeenCalledWith(
                expect.objectContaining({ amount: new Decimal(0) }),
            )
        })
    })
})
