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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SwapHistoryItem } from '@perawallet/wallet-core-swaps'
import { VISIBLE_SWAP_STATUSES } from '../../../constants'
import {
    useSwapHistoryList,
    type ListedSwapHistoryItem,
} from '../useSwapHistoryList'

const { SCOPE, ETH_SCOPE } = vi.hoisted(() => ({
    SCOPE: { chainId: 'algorand', networkId: 'mainnet' } as const,
    ETH_SCOPE: { chainId: 'ethereum', networkId: 'mainnet' } as const,
}))

const {
    mockExplorerUrlFor,
    mockPushWebView,
    mockTrackEvent,
    mockHistory,
    mockAddresses,
} = vi.hoisted(() => ({
    mockExplorerUrlFor: vi.fn(),
    mockPushWebView: vi.fn(),
    mockTrackEvent: vi.fn(),
    mockHistory: vi.fn(),
    mockAddresses: { current: [] as unknown[] },
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    swapExplorerUrlFor: mockExplorerUrlFor,
    useSwapHistoryInfiniteQuery: mockHistory,
    useSwapAccount: () => null,
}))

vi.mock('../../../hooks/useSwapAccountAddresses', () => ({
    useSwapAccountAddresses: () => mockAddresses.current,
}))

vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackEvent: mockTrackEvent,
}))

const item = {
    orderId: 'order-1',
    assetIn: { unitName: 'ALGO' },
    assetOut: { unitName: 'USDC' },
} as unknown as ListedSwapHistoryItem

const historyOf = (swaps: SwapHistoryItem[]) => ({
    swaps,
    isLoading: false,
    isError: false,
    isAccountNotOnDevice: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
})

describe('useSwapHistoryList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockHistory.mockReturnValue(historyOf([]))
        mockAddresses.current = [
            { scope: SCOPE, address: 'ADDR', isOnDevice: true },
            { scope: ETH_SCOPE, address: '0xETH', isOnDevice: true },
        ]
    })

    it('reads every swap-chain address of the account, the swap scope first', () => {
        renderHook(() =>
            useSwapHistoryList({
                scope: ETH_SCOPE,
                address: '0xETH',
                onClose: vi.fn(),
            }),
        )

        expect(mockHistory).toHaveBeenCalledWith(
            [
                { scope: ETH_SCOPE, address: '0xETH', isOnDevice: true },
                { scope: SCOPE, address: 'ADDR', isOnDevice: true },
            ],
            VISIBLE_SWAP_STATUSES,
        )
    })

    it('carries whether device registration sends each address', () => {
        mockAddresses.current = [
            { scope: SCOPE, address: 'ADDR', isOnDevice: true },
            { scope: ETH_SCOPE, address: '0xETH', isOnDevice: false },
        ]

        renderHook(() =>
            useSwapHistoryList({
                scope: ETH_SCOPE,
                address: '0xETH',
                onClose: vi.fn(),
            }),
        )

        expect(mockHistory).toHaveBeenCalledWith(
            [
                { scope: ETH_SCOPE, address: '0xETH', isOnDevice: false },
                { scope: SCOPE, address: 'ADDR', isOnDevice: true },
            ],
            VISIBLE_SWAP_STATUSES,
        )
    })

    it('shows the not-on-device state instead of the error or empty state', () => {
        mockHistory.mockReturnValue({
            ...historyOf([]),
            isError: true,
            isAccountNotOnDevice: true,
        })

        const { result } = renderHook(() =>
            useSwapHistoryList({
                scope: SCOPE,
                address: 'ADDR',
                onClose: vi.fn(),
            }),
        )

        expect(result.current.shouldShowNotOnDeviceState).toBe(true)
        expect(result.current.shouldShowErrorState).toBe(false)
        expect(result.current.shouldShowEmptyState).toBe(false)
    })

    it('hides rows naming an asset this wallet cannot resolve', () => {
        const legacy = {
            ...item,
            orderId: 'legacy',
            assetOut: null,
        } as unknown as SwapHistoryItem
        mockHistory.mockReturnValue(historyOf([legacy, item]))

        const { result } = renderHook(() =>
            useSwapHistoryList({
                scope: SCOPE,
                address: 'ADDR',
                onClose: vi.fn(),
            }),
        )

        expect(result.current.swaps).toEqual([
            { ...item, explorerUrl: undefined },
        ])
        expect(result.current.keyExtractor(result.current.swaps[0])).toBe(
            'order-1',
        )
    })

    it("opens the swap on its chain's explorer", () => {
        mockHistory.mockReturnValue(historyOf([item]))
        mockExplorerUrlFor.mockReturnValue(
            'https://explorer.test/tx-group/GROUP/',
        )
        const onClose = vi.fn()
        const { result } = renderHook(() =>
            useSwapHistoryList({ scope: SCOPE, address: 'ADDR', onClose }),
        )

        const [listed] = result.current.swaps
        expect(listed.explorerUrl).toBe('https://explorer.test/tx-group/GROUP/')
        result.current.handleItemPress(listed)

        expect(mockExplorerUrlFor).toHaveBeenCalledWith(SCOPE, item)
        expect(onClose).toHaveBeenCalled()
        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'https://explorer.test/tx-group/GROUP/',
            }),
        )
        expect(mockTrackEvent).toHaveBeenCalledWith(
            'swapscr_swap_history_see_all_asset_select',
            { chain_id: 'algorand', swap_pairing: 'ALGO/USDC' },
        )
    })

    it('does nothing when the swap has nothing to link to', () => {
        mockHistory.mockReturnValue(historyOf([item]))
        mockExplorerUrlFor.mockReturnValue(undefined)
        const onClose = vi.fn()
        const { result } = renderHook(() =>
            useSwapHistoryList({ scope: SCOPE, address: 'ADDR', onClose }),
        )

        const [listed] = result.current.swaps
        expect(listed.explorerUrl).toBeUndefined()
        result.current.handleItemPress(listed)

        expect(onClose).not.toHaveBeenCalled()
        expect(mockPushWebView).not.toHaveBeenCalled()
        expect(mockTrackEvent).not.toHaveBeenCalled()
    })
})
