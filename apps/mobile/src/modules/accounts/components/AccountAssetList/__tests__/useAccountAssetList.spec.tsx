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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { useAccountAssetList } from '../useAccountAssetList'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockAccount = {
    address: 'test-address',
    name: 'Test Account',
} as WalletAccount

const mockT = (key: string) => key

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: vi.fn() }),
    createNavigationContainerRef: () => ({
        isReady: () => false,
        navigate: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        current: null,
    }),
}))

vi.mock('@react-navigation/native-stack', () => ({}))

const makeHolding = (assetId: string) => ({
    assetId,
    amount: new Decimal(0),
    isFrozen: false,
    decimals: null,
    creatorAddress: null,
    totalSupply: null,
    name: null,
    unitName: null,
    url: null,
    metadata: null,
    peraMetadataJson: null,
    isFavorited: false,
    usdPrice: null,
})

const { mockAssetsQuery, mockPreferences } = vi.hoisted(() => ({
    mockAssetsQuery: {
        holdings: [] as unknown[],
        isPending: false,
        isPlaceholderData: false,
    },
    mockPreferences: { assetSortMode: 'balanceDesc' },
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountAssetsQuery: vi.fn(() => ({
            holdings: mockAssetsQuery.holdings,
            isPending: mockAssetsQuery.isPending,
            isPlaceholderData: mockAssetsQuery.isPlaceholderData,
            isError: false,
            isRefetching: false,
        })),
    }
})

const { mockOptOut } = vi.hoisted(() => ({
    mockOptOut: vi.fn().mockResolvedValue({ txIds: ['tx1'] }),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAssetOptOutMutation: () => ({
        optOut: mockOptOut,
        isLoading: false,
    }),
}))

const { mockShowToast, mockShowError } = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
    mockShowError: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useAssetPreferencesStore: vi.fn(
            (selector: (state: unknown) => unknown) =>
                selector({
                    hideZeroBalance: false,
                    displayNfts: true,
                    displayOptedInNfts: true,
                    assetSortMode: mockPreferences.assetSortMode,
                }),
        ),
        isCollectible: vi.fn(() => false),
    }
})

vi.mock('@constants/ui', async () => {
    const actual =
        await vi.importActual<typeof import('@constants/ui')>('@constants/ui')
    return {
        ...actual,
        SEARCH_DEBOUNCE_TIME_SHORT: 150,
        SHORT_PROMPT_DISPLAY_DELAY: 300,
        LONG_PROMPT_DISPLAY_DELAY: 600,
    }
})

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

describe('useAccountAssetList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAssetsQuery.holdings = [makeHolding('123')]
        mockAssetsQuery.isPending = false
        mockAssetsQuery.isPlaceholderData = false
        mockPreferences.assetSortMode = 'balanceDesc'
    })

    it('does not show an error toast when user cancels the signing overlay', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce('confirm')
        mockOptOut.mockRejectedValueOnce(new UserRejectedSigningError())

        const { result } = renderHook(() =>
            useAccountAssetList({ account: mockAccount, t: mockT }),
        )

        await act(async () => {
            await result.current.handleOptOut({
                assetId: '123',
                amount: new Decimal(0),
                isFrozen: false,
                decimals: null,
                creatorAddress: null,
                totalSupply: null,
                name: null,
                unitName: null,
                url: null,
                metadata: null,
                peraMetadataJson: null,
                isFavorited: false,
                usdPrice: null,
            })
        })

        expect(mockShowError).not.toHaveBeenCalled()
    })

    it('shows an error toast when opt-out fails with a non-cancel error', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce('confirm')
        const optOutError = new Error('Network error')
        mockOptOut.mockRejectedValueOnce(optOutError)

        const { result } = renderHook(() =>
            useAccountAssetList({ account: mockAccount, t: mockT }),
        )

        await act(async () => {
            await result.current.handleOptOut({
                assetId: '123',
                amount: new Decimal(0),
                isFrozen: false,
                decimals: null,
                creatorAddress: null,
                totalSupply: null,
                name: null,
                unitName: null,
                url: null,
                metadata: null,
                peraMetadataJson: null,
                isFavorited: false,
                usdPrice: null,
            })
        })

        expect(mockShowError).toHaveBeenCalledWith(
            optOutError,
            'asset_opt_out.error',
        )
    })

    // PERA-4921: re-sorting or switching account is a new query key, so the rows
    // go through a gap before the new ones land. The reset has to survive it.
    describe('scroll reset when the requested view changes', () => {
        const attachListRef = (result: {
            current: ReturnType<typeof useAccountAssetList>
        }) => {
            const scrollToOffset = vi.fn()
            result.current.listRef.current = {
                scrollToOffset,
                scrollToIndex: vi.fn(),
                scrollToEnd: vi.fn(),
            }
            return scrollToOffset
        }

        const flushFrame = async () => {
            await act(async () => {
                await new Promise(resolve =>
                    requestAnimationFrame(() => resolve(null)),
                )
            })
        }

        it('does not scroll on the first render', async () => {
            const { result } = renderHook(() =>
                useAccountAssetList({ account: mockAccount, t: mockT }),
            )
            const scrollToOffset = attachListRef(result)

            await flushFrame()

            expect(scrollToOffset).not.toHaveBeenCalled()
        })

        it('scrolls to the top once the rows for a new sort arrive after an empty tick', async () => {
            const { result, rerender } = renderHook(() =>
                useAccountAssetList({ account: mockAccount, t: mockT }),
            )
            const scrollToOffset = attachListRef(result)

            mockPreferences.assetSortMode = 'nameAsc'
            mockAssetsQuery.holdings = []
            mockAssetsQuery.isPending = true
            rerender({})
            await flushFrame()

            expect(scrollToOffset).not.toHaveBeenCalled()

            mockAssetsQuery.holdings = [makeHolding('456'), makeHolding('123')]
            mockAssetsQuery.isPending = false
            rerender({})
            await flushFrame()

            expect(scrollToOffset).toHaveBeenCalledWith({
                offset: 0,
                animated: true,
            })
        })

        it('waits for the new order instead of resetting on placeholder rows', async () => {
            const { result, rerender } = renderHook(() =>
                useAccountAssetList({ account: mockAccount, t: mockT }),
            )
            const scrollToOffset = attachListRef(result)

            mockPreferences.assetSortMode = 'nameAsc'
            mockAssetsQuery.isPlaceholderData = true
            rerender({})
            await flushFrame()

            expect(scrollToOffset).not.toHaveBeenCalled()

            mockAssetsQuery.isPlaceholderData = false
            mockAssetsQuery.holdings = [makeHolding('456')]
            rerender({})
            await flushFrame()

            expect(scrollToOffset).toHaveBeenCalledTimes(1)
        })

        it('starts a switched-to account at the top without animating', async () => {
            const { result, rerender } = renderHook(
                ({ account }: { account: WalletAccount }) =>
                    useAccountAssetList({ account, t: mockT }),
                { initialProps: { account: mockAccount } },
            )
            const scrollToOffset = attachListRef(result)

            mockAssetsQuery.holdings = [makeHolding('789')]
            rerender({
                account: { ...mockAccount, address: 'other-address' },
            })
            await flushFrame()

            expect(scrollToOffset).toHaveBeenCalledWith({
                offset: 0,
                animated: false,
            })
        })
    })
})
