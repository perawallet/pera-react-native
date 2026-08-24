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
import { type MutableRefObject } from 'react'
import { renderHook, act } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { type PWFlatListRef } from '@components/core'
import { useAccountNfts } from '../useAccountNfts'

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
const mockUseAccountCollectiblesQuery = vi.fn()
const mockUseCanSignWith = vi.fn()
const mockUseAccountOptInRoundsQuery = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useSelectedAccount: (...args: unknown[]) =>
            mockUseSelectedAccount(...args),
        useAccountCollectiblesQuery: (...args: unknown[]) =>
            mockUseAccountCollectiblesQuery(...args),
        useCanSignWith: (...args: unknown[]) => mockUseCanSignWith(...args),
        useAccountOptInRoundsQuery: (...args: unknown[]) =>
            mockUseAccountOptInRoundsQuery(...args),
    }
})

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

// Filtering, searching and ordering now happen in SQL — see the
// `getAccountCollectiblesLite` suite in the accounts package for those. These
// tests cover what the hook still owns: query wiring and the opt-in-round sort.
const makeRow = (assetId: string, title: string) => ({
    assetId,
    amount: new Decimal(1),
    decimals: 0,
    creatorAddress: 'CREATOR',
    totalSupply: '1',
    name: `Asset ${title}`,
    unitName: 'NFT',
    url: null,
    metadata: null,
    peraMetadataJson: null,
    title,
    collectionName: null,
})

const createDeferred = () => {
    let resolve: () => void = () => {}
    const promise = new Promise<void>(res => {
        resolve = () => res()
    })
    return { promise, resolve }
}

const attachListRef = (listRef: MutableRefObject<PWFlatListRef | null>) => {
    const scrollToOffset = vi.fn()
    listRef.current = {
        scrollToOffset,
        scrollToIndex: vi.fn(),
        scrollToEnd: vi.fn(),
    }
    return scrollToOffset
}

// The reset is deferred a frame so it lands after FlashList's own layout pass.
const flushFrame = async () => {
    await act(async () => {
        await new Promise(resolve => requestAnimationFrame(() => resolve(null)))
    })
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
        mockUseCanSignWith.mockReturnValue(true)
        mockUseAccountOptInRoundsQuery.mockReturnValue({
            optInRounds: new Map<string, number>(),
            isPending: false,
        })
        mockUseAccountCollectiblesQuery.mockReturnValue({
            collectibles: [makeRow('100', 'Cool NFT'), makeRow('200', 'Zed')],
            isPending: false,
        })
    })

    describe('query wiring', () => {
        it('passes the selected account, sort mode and opted-in filter through', () => {
            renderHook(() => useAccountNfts())

            expect(mockUseAccountCollectiblesQuery).toHaveBeenCalledWith(
                mockAccount.address,
                expect.objectContaining({
                    sortMode: 'titleAsc',
                    includeOptedInOnly: false,
                }),
            )
        })

        it('shows opted-in-only collectibles when the preference is on', () => {
            mockShowOptedIn = true
            renderHook(() => useAccountNfts())

            expect(mockUseAccountCollectiblesQuery).toHaveBeenCalledWith(
                mockAccount.address,
                expect.objectContaining({ includeOptedInOnly: true }),
            )
        })

        it('passes the search term down so SQL narrows the read', () => {
            const { result } = renderHook(() => useAccountNfts())

            act(() => {
                result.current.setSearchFilter('cool')
            })

            expect(mockUseAccountCollectiblesQuery).toHaveBeenLastCalledWith(
                mockAccount.address,
                expect.objectContaining({ search: 'cool' }),
            )
        })

        // Opt-in round lives in an indexer query, so SQL can't express it.
        it('leaves the SQL sort unset for recentlyAdded', () => {
            mockSortMode = 'recentlyAdded'
            renderHook(() => useAccountNfts())

            expect(mockUseAccountCollectiblesQuery).toHaveBeenCalledWith(
                mockAccount.address,
                expect.objectContaining({ sortMode: undefined }),
            )
        })

        it('enables the opt-in rounds query only for the recentlyAdded mode', () => {
            renderHook(() => useAccountNfts())
            expect(mockUseAccountOptInRoundsQuery).toHaveBeenCalledWith(
                mockAccount.address,
                false,
            )

            mockSortMode = 'recentlyAdded'
            renderHook(() => useAccountNfts())
            expect(mockUseAccountOptInRoundsQuery).toHaveBeenLastCalledWith(
                mockAccount.address,
                true,
            )
        })

        it('returns the SQL order untouched for SQL-expressible modes', () => {
            const { result } = renderHook(() => useAccountNfts())

            expect(result.current.collectibles.map(c => c.assetId)).toEqual([
                '100',
                '200',
            ])
            expect(result.current.collectibleCount).toBe(2)
        })
    })

    describe('recentlyAdded ordering', () => {
        beforeEach(() => {
            mockSortMode = 'recentlyAdded'
        })

        it('puts the most recently opted-in collectible first', () => {
            mockUseAccountOptInRoundsQuery.mockReturnValue({
                optInRounds: new Map([
                    ['100', 10],
                    ['200', 99],
                ]),
                isPending: false,
            })

            const { result } = renderHook(() => useAccountNfts())

            expect(result.current.collectibles.map(c => c.assetId)).toEqual([
                '200',
                '100',
            ])
        })

        it('floats collectibles with no known opt-in round above the rest', () => {
            mockUseAccountOptInRoundsQuery.mockReturnValue({
                optInRounds: new Map([['200', 5]]),
                isPending: false,
            })

            const { result } = renderHook(() => useAccountNfts())

            expect(result.current.collectibles.map(c => c.assetId)).toEqual([
                '100',
                '200',
            ])
        })

        // PERA-4845 QA regression: an NFT opted into seconds ago is already a
        // holding row (SQLite mirrors algod) but the lagging indexer has no
        // round for it yet. It must lead the list instantly, not sink.
        it('puts a fresh opt-in the indexer does not know yet on top', () => {
            mockUseAccountCollectiblesQuery.mockReturnValue({
                collectibles: [
                    makeRow('900', 'Fresh Mint'),
                    makeRow('200', 'Zed'),
                    makeRow('100', 'Cool NFT'),
                ],
                isPending: false,
            })
            mockUseAccountOptInRoundsQuery.mockReturnValue({
                optInRounds: new Map([
                    ['100', 50],
                    ['200', 99],
                ]),
                isPending: false,
            })

            const { result } = renderHook(() => useAccountNfts())

            expect(result.current.collectibles.map(c => c.assetId)).toEqual([
                '900',
                '200',
                '100',
            ])
        })

        it('keeps the SQL order for collectibles that tie', () => {
            mockUseAccountOptInRoundsQuery.mockReturnValue({
                optInRounds: new Map<string, number>(),
                isPending: false,
            })

            const { result } = renderHook(() => useAccountNfts())

            expect(result.current.collectibles.map(c => c.assetId)).toEqual([
                '100',
                '200',
            ])
        })
    })

    // PERA-4921 QA regression: sorting a freshly imported account left the user
    // in the middle of the list. A new sort is a new query key, so the rows go
    // through a gap before the reordered ones land, and the reset used to be
    // driven off the rows themselves — so it read that gap as "nothing changed"
    // and never fired, leaving FlashList to re-anchor on the old top row.
    describe('scroll reset when the requested view changes', () => {
        const rows = [makeRow('100', 'Cool NFT'), makeRow('200', 'Zed')]
        const reorderedRows = [
            makeRow('200', 'Zed'),
            makeRow('100', 'Cool NFT'),
        ]

        it('does not scroll on the first render', async () => {
            const { result } = renderHook(() => useAccountNfts())
            const scrollToOffset = attachListRef(result.current.flatListRef)

            await flushFrame()

            expect(scrollToOffset).not.toHaveBeenCalled()
        })

        it('scrolls to the top once the rows for a new sort arrive after an empty tick', async () => {
            const { result, rerender } = renderHook(() => useAccountNfts())
            const scrollToOffset = attachListRef(result.current.flatListRef)

            mockSortMode = 'titleDesc'
            mockUseAccountCollectiblesQuery.mockReturnValue({
                collectibles: [],
                isPending: true,
            })
            rerender()
            await flushFrame()

            expect(scrollToOffset).not.toHaveBeenCalled()

            mockUseAccountCollectiblesQuery.mockReturnValue({
                collectibles: reorderedRows,
                isPending: false,
            })
            rerender()
            await flushFrame()

            expect(scrollToOffset).toHaveBeenCalledWith({
                offset: 0,
                animated: false,
            })
        })

        it('waits for the new order instead of resetting on placeholder rows', async () => {
            const { result, rerender } = renderHook(() => useAccountNfts())
            const scrollToOffset = attachListRef(result.current.flatListRef)

            // The previous order, held on screen while the new one resolves.
            mockSortMode = 'titleDesc'
            mockUseAccountCollectiblesQuery.mockReturnValue({
                collectibles: rows,
                isPending: false,
                isPlaceholderData: true,
            })
            rerender()
            await flushFrame()

            expect(scrollToOffset).not.toHaveBeenCalled()

            mockUseAccountCollectiblesQuery.mockReturnValue({
                collectibles: reorderedRows,
                isPending: false,
                isPlaceholderData: false,
            })
            rerender()
            await flushFrame()

            expect(scrollToOffset).toHaveBeenCalledTimes(1)
        })

        // A placeholder gap re-runs the effect, and its cleanup cancels the
        // frame the previous run scheduled. Recording the request as applied
        // before that frame ran made the cancellation permanent (PERA-4932).
        it('still resets once the rows land if a placeholder gap cancelled the scheduled frame', async () => {
            const { result, rerender } = renderHook(() => useAccountNfts())
            const scrollToOffset = attachListRef(result.current.flatListRef)

            // The new order's rows land and schedule a reset for the next frame.
            mockSortMode = 'titleDesc'
            mockUseAccountCollectiblesQuery.mockReturnValue({
                collectibles: reorderedRows,
                isPending: false,
                isPlaceholderData: false,
            })
            rerender()

            // A refetch re-enters the placeholder gap before that frame runs.
            mockUseAccountCollectiblesQuery.mockReturnValue({
                collectibles: reorderedRows,
                isPending: false,
                isPlaceholderData: true,
            })
            rerender()
            await flushFrame()

            expect(scrollToOffset).not.toHaveBeenCalled()

            mockUseAccountCollectiblesQuery.mockReturnValue({
                collectibles: reorderedRows,
                isPending: false,
                isPlaceholderData: false,
            })
            rerender()
            await flushFrame()

            expect(scrollToOffset).toHaveBeenCalledTimes(1)
        })

        it('scrolls to the top when a search term narrows the list', async () => {
            const { result, rerender } = renderHook(() => useAccountNfts())
            const scrollToOffset = attachListRef(result.current.flatListRef)

            act(() => {
                result.current.setSearchFilter('cool')
            })
            mockUseAccountCollectiblesQuery.mockReturnValue({
                collectibles: [makeRow('100', 'Cool NFT')],
                isPending: false,
            })
            rerender()
            await flushFrame()

            expect(scrollToOffset).toHaveBeenCalledWith({
                offset: 0,
                animated: false,
            })
        })

        // recentlyAdded is ordered by a separate indexer query, so its rows land
        // before the rounds that order them: the map arriving is a reorder too.
        it('scrolls to the top once the opt-in rounds reorder recentlyAdded', async () => {
            mockSortMode = 'recentlyAdded'
            const { result, rerender } = renderHook(() => useAccountNfts())
            const scrollToOffset = attachListRef(result.current.flatListRef)

            mockUseAccountOptInRoundsQuery.mockReturnValue({
                optInRounds: new Map([
                    ['100', 10],
                    ['200', 99],
                ]),
                isPending: false,
            })
            rerender()
            await flushFrame()

            expect(scrollToOffset).toHaveBeenCalledWith({
                offset: 0,
                animated: false,
            })
        })

        it('does not scroll again while the same request re-renders', async () => {
            const { result, rerender } = renderHook(() => useAccountNfts())
            const scrollToOffset = attachListRef(result.current.flatListRef)

            mockSortMode = 'titleDesc'
            mockUseAccountCollectiblesQuery.mockReturnValue({
                collectibles: reorderedRows,
                isPending: false,
            })
            rerender()
            await flushFrame()
            expect(scrollToOffset).toHaveBeenCalledTimes(1)

            // A sync invalidation re-reads the same request.
            mockUseAccountCollectiblesQuery.mockReturnValue({
                collectibles: [...reorderedRows],
                isPending: false,
            })
            rerender()
            await flushFrame()

            expect(scrollToOffset).toHaveBeenCalledTimes(1)
        })
    })

    describe('pending state', () => {
        it('reports the collectibles query pending state', () => {
            mockUseAccountCollectiblesQuery.mockReturnValue({
                collectibles: [],
                isPending: true,
            })

            const { result } = renderHook(() => useAccountNfts())

            expect(result.current.isPending).toBe(true)
            expect(result.current.collectibles).toHaveLength(0)
        })

        it('is settled once the read resolves', () => {
            const { result } = renderHook(() => useAccountNfts())

            expect(result.current.isPending).toBe(false)
        })
    })

    it('returns hasAccount false when no account selected', () => {
        mockUseSelectedAccount.mockReturnValue(null)
        mockUseAccountCollectiblesQuery.mockReturnValue({
            collectibles: [],
            isPending: false,
        })

        const { result } = renderHook(() => useAccountNfts())

        expect(result.current.hasAccount).toBe(false)
        expect(result.current.collectibles).toHaveLength(0)
    })

    it('reads gallery layout from store', () => {
        mockGalleryLayout = 'list'
        const { result } = renderHook(() => useAccountNfts())

        expect(result.current.galleryLayout).toBe('list')
    })

    it('calls store setter when setSortMode is invoked', () => {
        const { result } = renderHook(() => useAccountNfts())

        act(() => {
            result.current.setSortMode('titleDesc')
        })

        expect(mockSetCollectibleSortMode).toHaveBeenCalledWith('titleDesc')
    })

    it('calls store setter when setGalleryLayout is invoked', () => {
        const { result } = renderHook(() => useAccountNfts())

        act(() => {
            result.current.setGalleryLayout('list')
        })

        expect(mockSetGalleryLayout).toHaveBeenCalledWith('list')
    })

    it('navigates to CollectibleDetails on press', () => {
        const { result } = renderHook(() => useAccountNfts())

        act(() => {
            result.current.handlePress(result.current.collectibles[0])
        })

        expect(mockNavigate).toHaveBeenCalledWith('CollectibleDetails', {
            assetId: '100',
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
