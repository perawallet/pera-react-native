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
    createNavigationContainerRef: () => ({
        isReady: () => false,
        navigate: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        current: null,
    }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: vi.fn(),
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

const mockRefreshAccounts = vi.fn(() => Promise.resolve())
const mockInvalidateQueries = vi.fn()

vi.mock('@perawallet/wallet-core-background', () => ({
    getSyncService: () => ({
        refreshAccounts: mockRefreshAccounts,
        invalidateQueries: mockInvalidateQueries,
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        useNetwork: () => ({ network: 'mainnet' }),
    }
})

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
const mockUseCanSignWith = vi.fn()
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
        useCanSignWith: (...args: unknown[]) => mockUseCanSignWith(...args),
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
    totalSupply: new Decimal(1_000_000),
    creator: { address: 'CREATOR' },
    peraMetadata: {
        isDeleted: false,
        verificationTier: 'verified',
        type: 'standard_asset',
    },
})

const createDeferred = () => {
    let resolve: () => void = () => {}
    const promise = new Promise<void>(res => {
        resolve = () => res()
    })
    return { promise, resolve }
}

describe('useAccountNfts', () => {
    const mockAccount = {
        address: 'ACCOUNT_ADDRESS_58_CHARS_LONG_AAAAAAAAAAAAAAAAAAAAAAAAAAA',
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockNavigate.mockReset()
        mockRefreshAccounts.mockResolvedValue(undefined)
        mockSortMode = 'titleAsc'
        mockGalleryLayout = 'grid'
        mockShowOptedIn = false
        mockUseSelectedAccount.mockReturnValue(mockAccount)
        mockUseAllAccounts.mockReturnValue([mockAccount])
        mockUseCanSignWith.mockReturnValue(true)

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
                                amount: new Decimal(1_000_000),
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
                                amount: new Decimal(1_000_000),
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

        it('hides zero-amount NFTs when showOptedIn is false', () => {
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

    describe('pull to refresh', () => {
        it('refreshes the selected account through the sync service', async () => {
            const { result } = renderHook(() => useAccountNfts())

            await act(async () => {
                result.current.handleRefresh()
            })

            expect(mockRefreshAccounts).toHaveBeenCalledWith(
                [mockAccount.address],
                'mainnet',
            )
            expect(mockInvalidateQueries).not.toHaveBeenCalled()
        })

        it('reports isRefreshing while the sync refresh is in flight', async () => {
            const deferred = createDeferred()
            mockRefreshAccounts.mockReturnValue(deferred.promise)
            const { result } = renderHook(() => useAccountNfts())

            expect(result.current.isRefreshing).toBe(false)

            act(() => {
                result.current.handleRefresh()
            })
            expect(result.current.isRefreshing).toBe(true)

            await act(async () => {
                deferred.resolve()
                await deferred.promise
            })
            expect(result.current.isRefreshing).toBe(false)
        })
    })

    describe('canOptIn', () => {
        it('returns true for signing accounts', () => {
            mockUseCanSignWith.mockReturnValue(true)
            const { result } = renderHook(() => useAccountNfts())

            expect(result.current.canOptIn).toBe(true)
        })

        it('returns false for non-signing accounts', () => {
            mockUseCanSignWith.mockReturnValue(false)
            const { result } = renderHook(() => useAccountNfts())

            expect(result.current.canOptIn).toBe(false)
        })
    })
})
