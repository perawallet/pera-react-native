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

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const { mockExplorerUrlFor, mockPushWebView, mockTrackEvent, mockHistory } =
    vi.hoisted(() => ({
        mockExplorerUrlFor: vi.fn(),
        mockPushWebView: vi.fn(),
        mockTrackEvent: vi.fn(),
        mockHistory: vi.fn(),
    }))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    swapExplorerUrlFor: mockExplorerUrlFor,
    useSwapHistoryInfiniteQuery: mockHistory,
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
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
})

describe('useSwapHistoryList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockHistory.mockReturnValue(historyOf([]))
    })

    it('asks for the visible statuses on the scope', () => {
        renderHook(() =>
            useSwapHistoryList({ scope: SCOPE, address: 'ADDR', onClose: vi.fn() }),
        )

        expect(mockHistory).toHaveBeenCalledWith(
            'ADDR',
            SCOPE,
            VISIBLE_SWAP_STATUSES,
        )
    })

    it('hides rows naming an asset this wallet cannot resolve', () => {
        const legacy = {
            ...item,
            orderId: 'legacy',
            assetOut: null,
        } as unknown as SwapHistoryItem
        mockHistory.mockReturnValue(historyOf([legacy, item]))

        const { result } = renderHook(() =>
            useSwapHistoryList({ scope: SCOPE, address: 'ADDR', onClose: vi.fn() }),
        )

        expect(result.current.swaps).toEqual([item])
        expect(result.current.keyExtractor(item)).toBe('order-1')
    })

    it("opens the swap on its chain's explorer", () => {
        mockExplorerUrlFor.mockReturnValue(
            'https://explorer.test/tx-group/GROUP/',
        )
        const onClose = vi.fn()
        const { result } = renderHook(() =>
            useSwapHistoryList({ scope: SCOPE, address: 'ADDR', onClose }),
        )

        result.current.handleItemPress(item)

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
        mockExplorerUrlFor.mockReturnValue(undefined)
        const onClose = vi.fn()
        const { result } = renderHook(() =>
            useSwapHistoryList({ scope: SCOPE, address: 'ADDR', onClose }),
        )

        result.current.handleItemPress(item)

        expect(onClose).not.toHaveBeenCalled()
        expect(mockPushWebView).not.toHaveBeenCalled()
        expect(mockTrackEvent).not.toHaveBeenCalled()
    })
})
