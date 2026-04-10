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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { useSortedAssetBalances } from '../useSortedAssetBalances'

let mockSortMode = 'balanceDesc'
const mockSetSortMode = vi.fn()

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetPreferencesStore: vi.fn((selector: (state: unknown) => unknown) =>
        selector({
            assetSortMode: mockSortMode,
            setAssetSortMode: mockSetSortMode,
        }),
    ),
}))

const mockAssets = new Map([
    ['0', { name: 'Algorand', peraMetadata: { isFavorited: false } }],
    ['1', { name: 'Banana', peraMetadata: { isFavorited: false } }],
    ['2', { name: 'Apple', peraMetadata: { isFavorited: true } }],
    ['3', { name: 'Cherry', peraMetadata: { isFavorited: false } }],
])

const mockBalances = [
    {
        assetId: '0',
        amount: new Decimal('1000'),
        algoValue: new Decimal('1000'),
    },
    { assetId: '1', amount: new Decimal('500'), algoValue: new Decimal('500') },
    { assetId: '2', amount: new Decimal('200'), algoValue: new Decimal('200') },
    { assetId: '3', amount: new Decimal(0), algoValue: new Decimal(0) },
]

describe('useSortedAssetBalances', () => {
    beforeEach(() => {
        mockSortMode = 'balanceDesc'
    })

    it('sorts by balance descending by default with favorited first', () => {
        // Arrange
        // default mockSortMode is 'balanceDesc'

        // Act
        const { result } = renderHook(() =>
            useSortedAssetBalances(mockBalances, mockAssets as never),
        )

        // Assert
        const ids = result.current.sortedBalances.map(b => b.assetId)
        // Favorited first (asset '2'), then rest sorted by algoValue desc
        expect(ids).toEqual(['2', '0', '1', '3'])
    })

    it('sorts by balance ascending', () => {
        // Arrange
        mockSortMode = 'balanceAsc'

        // Act
        const { result } = renderHook(() =>
            useSortedAssetBalances(mockBalances, mockAssets as never),
        )

        // Assert
        const ids = result.current.sortedBalances.map(b => b.assetId)
        // Favorited first (asset '2'), then rest sorted by algoValue asc
        expect(ids).toEqual(['2', '3', '1', '0'])
    })

    it('sorts alphabetically A-Z with favorited first', () => {
        // Arrange
        mockSortMode = 'alphabeticalAsc'

        // Act
        const { result } = renderHook(() =>
            useSortedAssetBalances(mockBalances, mockAssets as never),
        )

        // Assert
        const ids = result.current.sortedBalances.map(b => b.assetId)
        // Favorited first: Apple ('2'), then rest alphabetical asc: Algorand ('0'), Banana ('1'), Cherry ('3')
        expect(ids).toEqual(['2', '0', '1', '3'])
    })

    it('sorts alphabetically Z-A with favorited first', () => {
        // Arrange
        mockSortMode = 'alphabeticalDesc'

        // Act
        const { result } = renderHook(() =>
            useSortedAssetBalances(mockBalances, mockAssets as never),
        )

        // Assert
        const ids = result.current.sortedBalances.map(b => b.assetId)
        // Favorited first: Apple ('2'), then rest alphabetical desc: Cherry ('3'), Banana ('1'), Algorand ('0')
        expect(ids).toEqual(['2', '3', '1', '0'])
    })

    it('always places favorited assets before non-favorited', () => {
        // Arrange
        mockSortMode = 'balanceDesc'

        // Act
        const { result } = renderHook(() =>
            useSortedAssetBalances(mockBalances, mockAssets as never),
        )

        // Assert
        const ids = result.current.sortedBalances.map(b => b.assetId)
        const favoritedIndex = ids.indexOf('2')
        const nonFavoritedIndices = ['0', '1', '3'].map(id => ids.indexOf(id))

        // Favorited asset '2' should come before all non-favorited assets
        for (const idx of nonFavoritedIndices) {
            expect(favoritedIndex).toBeLessThan(idx)
        }
    })
})
