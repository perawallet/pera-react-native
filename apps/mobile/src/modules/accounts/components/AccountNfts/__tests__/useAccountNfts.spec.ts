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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useAccountNfts } from '../useAccountNfts'
import type { PeraAsset } from '@perawallet/wallet-core-assets'

const mockNavigate = vi.fn()
vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
    }),
}))

vi.mock('@hooks/useDebouncedValue', () => ({
    useDebouncedValue: (value: string) => value,
}))

const mockUseSelectedAccount = vi.fn()
const mockUseAccountBalancesQuery = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useSelectedAccount: (...args: unknown[]) =>
            mockUseSelectedAccount(...args),
        useAccountBalancesQuery: (...args: unknown[]) =>
            mockUseAccountBalancesQuery(...args),
    }
})

const mockUseAssetsQuery = vi.fn()

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useAssetsQuery: (...args: unknown[]) => mockUseAssetsQuery(...args),
    }
})

const makeCollectibleAsset = (
    id: string,
    name: string,
    collectionName?: string,
): PeraAsset => ({
    assetId: id,
    name,
    decimals: 0,
    totalSupply: new Decimal(1),
    creator: { address: 'CREATOR' },
    peraMetadata: {
        isDeleted: false,
        verificationTier: 'unverified',
        type: 'collectible',
        collectible: {
            title: name,
            collection: collectionName ? { name: collectionName } : undefined,
            primaryImage: `https://example.com/${id}.png`,
        },
    },
})

const makeFungibleAsset = (id: string, name: string): PeraAsset => ({
    assetId: id,
    name,
    decimals: 6,
    totalSupply: new Decimal(1000000),
    creator: { address: 'CREATOR' },
    peraMetadata: {
        isDeleted: false,
        verificationTier: 'verified',
        type: 'standard_asset',
    },
})

describe('useAccountNfts', () => {
    const mockAccount = {
        address: 'ACCOUNT_ADDRESS_58_CHARS_LONG_AAAAAAAAAAAAAAAAAAAAAAAAAAA',
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockNavigate.mockReset()
        mockUseSelectedAccount.mockReturnValue(mockAccount)

        mockUseAccountBalancesQuery.mockReturnValue({
            accountBalances: new Map([
                [
                    mockAccount.address,
                    {
                        assetBalances: [
                            {
                                assetId: '100',
                                amount: new Decimal(1),
                                algoValue: new Decimal(0),
                            },
                            {
                                assetId: '200',
                                amount: new Decimal(5),
                                algoValue: new Decimal(0),
                            },
                            {
                                assetId: '300',
                                amount: new Decimal(1000000),
                                algoValue: new Decimal(10),
                            },
                        ],
                    },
                ],
            ]),
            isPending: false,
        })

        mockUseAssetsQuery.mockReturnValue({
            data: new Map<string, PeraAsset>([
                [
                    '100',
                    makeCollectibleAsset('100', 'Cool NFT', 'CoolCollection'),
                ],
                [
                    '200',
                    makeCollectibleAsset(
                        '200',
                        'Another NFT',
                        'AnotherCollection',
                    ),
                ],
                ['300', makeFungibleAsset('300', 'USDC')],
            ]),
        })
    })

    it('filters only collectible assets from balances', () => {
        const { result } = renderHook(() => useAccountNfts())

        expect(result.current.collectibles).toHaveLength(2)
        const ids = result.current.collectibles.map(c => c.assetId)
        expect(ids).toContain('100')
        expect(ids).toContain('200')
        expect(ids).not.toContain('300')
    })

    it('sorts collectibles by title ascending by default', () => {
        const { result } = renderHook(() => useAccountNfts())

        expect(result.current.sortMode).toBe('titleAsc')
        expect(result.current.collectibles[0].asset.name).toBe('Another NFT')
        expect(result.current.collectibles[1].asset.name).toBe('Cool NFT')
    })

    it('sorts collectibles by title descending', () => {
        const { result } = renderHook(() => useAccountNfts())

        act(() => {
            result.current.setSortMode('titleDesc')
        })

        expect(result.current.collectibles[0].asset.name).toBe('Cool NFT')
        expect(result.current.collectibles[1].asset.name).toBe('Another NFT')
    })

    it('filters collectibles by search term', () => {
        const { result } = renderHook(() => useAccountNfts())

        act(() => {
            result.current.setSearchFilter('Cool')
        })

        expect(result.current.collectibles).toHaveLength(1)
        expect(result.current.collectibles[0].assetId).toBe('100')
    })

    it('searches by collection name', () => {
        const { result } = renderHook(() => useAccountNfts())

        act(() => {
            result.current.setSearchFilter('AnotherCollection')
        })

        expect(result.current.collectibles).toHaveLength(1)
        expect(result.current.collectibles[0].assetId).toBe('200')
    })

    it('toggles gallery layout between grid and list', () => {
        const { result } = renderHook(() => useAccountNfts())

        expect(result.current.galleryLayout).toBe('grid')

        act(() => {
            result.current.toggleGalleryLayout()
        })

        expect(result.current.galleryLayout).toBe('list')

        act(() => {
            result.current.toggleGalleryLayout()
        })

        expect(result.current.galleryLayout).toBe('grid')
    })

    it('navigates to AssetDetails on press', () => {
        const { result } = renderHook(() => useAccountNfts())

        act(() => {
            result.current.handlePress(result.current.collectibles[0])
        })

        expect(mockNavigate).toHaveBeenCalledWith('AssetDetails', {
            assetId: result.current.collectibles[0].assetId,
        })
    })

    it('returns hasAccount false when no account selected', () => {
        mockUseSelectedAccount.mockReturnValue(null)

        const { result } = renderHook(() => useAccountNfts())

        expect(result.current.hasAccount).toBe(false)
        expect(result.current.collectibles).toHaveLength(0)
    })

    it('marks pure NFTs correctly', () => {
        const { result } = renderHook(() => useAccountNfts())

        for (const item of result.current.collectibles) {
            expect(item.isPure).toBe(true)
        }
    })

    it('returns empty array when no collectibles exist', () => {
        mockUseAssetsQuery.mockReturnValue({
            data: new Map<string, PeraAsset>([
                ['300', makeFungibleAsset('300', 'USDC')],
            ]),
        })

        mockUseAccountBalancesQuery.mockReturnValue({
            accountBalances: new Map([
                [
                    mockAccount.address,
                    {
                        assetBalances: [
                            {
                                assetId: '300',
                                amount: new Decimal(1000000),
                                algoValue: new Decimal(10),
                            },
                        ],
                    },
                ],
            ]),
            isPending: false,
        })

        const { result } = renderHook(() => useAccountNfts())

        expect(result.current.collectibles).toHaveLength(0)
    })
})
