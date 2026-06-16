/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import type { Optional } from '@perawallet/wallet-core-shared'
import { useAccountAssetSelectionList } from '../useAccountAssetSelectionList'

const mockUseSelectedAccount = vi.hoisted(() => vi.fn())
const mockUseAccountBalancesQuery = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: mockUseSelectedAccount,
    useAccountBalancesQuery: mockUseAccountBalancesQuery,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        useDebouncedValue: (value: unknown) => value,
    }
})

const mockAssetBalances = [
    {
        assetId: '31566704',
        amount: '500',
        asset: { assetId: '31566704', name: 'USD Coin', unitName: 'USDC' },
    },
    {
        assetId: '887406851',
        amount: '200',
        asset: { assetId: '887406851', name: 'Wrapped SOL', unitName: 'wSOL' },
    },
    {
        assetId: '0',
        amount: '1000000',
        asset: { assetId: '0', name: 'Algo', unitName: 'ALGO' },
    },
]

describe('useAccountAssetSelectionList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseSelectedAccount.mockReturnValue({ address: 'TEST_ADDRESS' })
        mockUseAccountBalancesQuery.mockReturnValue({
            accountBalances: new Map([
                ['TEST_ADDRESS', { assetBalances: mockAssetBalances }],
            ]),
        })
    })

    it('returns all assets with Algo first', () => {
        const { result } = renderHook(() => useAccountAssetSelectionList({}))

        expect(result.current.filteredBalanceData).toHaveLength(3)
        expect(result.current.filteredBalanceData[0].assetId).toBe('0')
    })

    it('filters by asset name', () => {
        const { result } = renderHook(() => useAccountAssetSelectionList({}))

        act(() => {
            result.current.setSearchFilter('USD Coin')
        })

        expect(result.current.filteredBalanceData).toHaveLength(1)
        expect(result.current.filteredBalanceData[0].assetId).toBe('31566704')
    })

    it('filters by unit name', () => {
        const { result } = renderHook(() => useAccountAssetSelectionList({}))

        act(() => {
            result.current.setSearchFilter('wSOL')
        })

        expect(result.current.filteredBalanceData).toHaveLength(1)
        expect(result.current.filteredBalanceData[0].assetId).toBe('887406851')
    })

    it('filters by asset ID', () => {
        const { result } = renderHook(() => useAccountAssetSelectionList({}))

        act(() => {
            result.current.setSearchFilter('887406851')
        })

        expect(result.current.filteredBalanceData).toHaveLength(1)
        expect(result.current.filteredBalanceData[0].assetId).toBe('887406851')
    })

    it('returns empty array when no account selected', () => {
        mockUseSelectedAccount.mockReturnValue(null)
        mockUseAccountBalancesQuery.mockReturnValue({
            accountBalances: new Map(),
        })

        const { result } = renderHook(() => useAccountAssetSelectionList({}))

        expect(result.current.filteredBalanceData).toHaveLength(0)
    })

    it('excludes asset when excludeAssetId is provided', () => {
        const { result } = renderHook(() =>
            useAccountAssetSelectionList({ excludeAssetId: '0' }),
        )

        expect(result.current.filteredBalanceData).toHaveLength(2)
        expect(
            result.current.filteredBalanceData.every(
                item => item.assetId !== '0',
            ),
        ).toBe(true)
    })

    it('applies filterAsset predicate', () => {
        const { result } = renderHook(() =>
            useAccountAssetSelectionList({
                filterAsset: item => item.assetId === '31566704',
            }),
        )

        expect(result.current.filteredBalanceData).toHaveLength(1)
        expect(result.current.filteredBalanceData[0].assetId).toBe('31566704')
    })

    it('clears search when isVisible becomes false', () => {
        const { result, rerender } = renderHook(
            ({ isVisible }) => useAccountAssetSelectionList({ isVisible }),
            { initialProps: { isVisible: true as Optional<boolean> } },
        )

        act(() => {
            result.current.setSearchFilter('Algo')
        })

        expect(result.current.filteredBalanceData).toHaveLength(1)

        rerender({ isVisible: false })

        expect(result.current.searchFilter).toBe('')
        expect(result.current.filteredBalanceData).toHaveLength(3)
    })
})
