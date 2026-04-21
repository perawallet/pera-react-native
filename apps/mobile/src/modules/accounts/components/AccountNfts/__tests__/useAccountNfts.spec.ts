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

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        useDebouncedValue: (value: unknown) => value,
    }
})

const mockUseSelectedAccount = vi.fn()
const mockUseAccountBalancesQuery = vi.fn()
const mockUseAccountLogicalType = vi.fn()
const mockUseAllAccounts = vi.fn()

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
        useAllAccounts: (...args: unknown[]) => mockUseAllAccounts(...args),
        useAccountLogicalType: (...args: unknown[]) =>
            mockUseAccountLogicalType(...args),
    }
})

const mockUseAssetsQuery = vi.fn()
const mockSetCollectibleSortMode = vi.fn()
const mockSetGalleryLayout = vi.fn()
const mockSetShowOptedIn = vi.fn()
let mockSortMode = 'titleAsc'
let mockGalleryLayout = 'grid'
let mockShowOptedIn = false

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useAssetsQuery: (...args: unknown[]) => mockUseAssetsQuery(...args),
        useCollectiblePreferencesStore: (
            selector: (state: Record<string, unknown>) => unknown,
        ) =>
            selector({
                collectibleSortMode: mockSortMode,
                galleryLayout: mockGalleryLayout,
                showOptedIn: mockShowOptedIn,
                setCollectibleSortMode: mockSetCollectibleSortMode,
                setGalleryLayout: mockSetGalleryLayout,
                setShowOptedIn: mockSetShowOptedIn,
            }),
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
        mockSortMode = 'titleAsc'
        mockGalleryLayout = 'grid'
        mockShowOptedIn = false
        mockUseSelectedAccount.mockReturnValue(mockAccount)
        mockUseAllAccounts.mockReturnValue([mockAccount])
        mockUseAccountLogicalType.mockReturnValue('Algo25')

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
        mockSortMode = 'titleDesc'
        const { result } = renderHook(() => useAccountNfts())

        expect(result.current.collectibles[0].asset.name).toBe('Cool NFT')
        expect(result.current.collectibles[1].asset.name).toBe('Another NFT')
    })

    it('sorts collectibles newest first by asset ID descending', () => {
        mockSortMode = 'newestFirst'
        const { result } = renderHook(() => useAccountNfts())

        expect(result.current.collectibles[0].assetId).toBe('200')
        expect(result.current.collectibles[1].assetId).toBe('100')
    })

    it('sorts collectibles oldest first by asset ID ascending', () => {
        mockSortMode = 'oldestFirst'
        const { result } = renderHook(() => useAccountNfts())

        expect(result.current.collectibles[0].assetId).toBe('100')
        expect(result.current.collectibles[1].assetId).toBe('200')
    })

    it('calls store setter when setSortMode is invoked', () => {
        const { result } = renderHook(() => useAccountNfts())

        act(() => {
            result.current.setSortMode('newestFirst')
        })

        expect(mockSetCollectibleSortMode).toHaveBeenCalledWith('newestFirst')
    })

    it('calls store setter when setGalleryLayout is invoked', () => {
        const { result } = renderHook(() => useAccountNfts())

        act(() => {
            result.current.setGalleryLayout('list')
        })

        expect(mockSetGalleryLayout).toHaveBeenCalledWith('list')
    })

    it('reads gallery layout from store', () => {
        mockGalleryLayout = 'list'
        const { result } = renderHook(() => useAccountNfts())

        expect(result.current.galleryLayout).toBe('list')
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

    it('navigates to AssetDetails on press', () => {
        const { result } = renderHook(() => useAccountNfts())

        act(() => {
            result.current.handlePress(result.current.collectibles[0])
        })

        expect(mockNavigate).toHaveBeenCalledWith('CollectibleDetails', {
            assetId: result.current.collectibles[0].assetId,
        })
    })

    it('returns hasAccount false when no account selected', () => {
        mockUseSelectedAccount.mockReturnValue(null)

        const { result } = renderHook(() => useAccountNfts())

        expect(result.current.hasAccount).toBe(false)
        expect(result.current.collectibles).toHaveLength(0)
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

    describe('opted-in filter', () => {
        beforeEach(() => {
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
                                    amount: new Decimal(0),
                                    algoValue: new Decimal(0),
                                },
                            ],
                        },
                    ],
                ]),
                isPending: false,
            })
        })

        it('hides zero-amount NFTs by default', () => {
            const { result } = renderHook(() => useAccountNfts())

            expect(result.current.collectibles).toHaveLength(1)
            expect(result.current.collectibles[0].assetId).toBe('100')
        })

        it('shows zero-amount NFTs when showOptedIn is true', () => {
            mockShowOptedIn = true
            const { result } = renderHook(() => useAccountNfts())

            expect(result.current.collectibles).toHaveLength(2)
        })
    })

    describe('canOptIn', () => {
        it('returns true for signing accounts', () => {
            mockUseAccountLogicalType.mockReturnValue('Algo25')
            const { result } = renderHook(() => useAccountNfts())

            expect(result.current.canOptIn).toBe(true)
        })

        it('returns false for non-signing accounts', () => {
            mockUseAccountLogicalType.mockReturnValue('NoAuth')
            const { result } = renderHook(() => useAccountNfts())

            expect(result.current.canOptIn).toBe(false)
        })
    })
})
