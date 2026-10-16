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

import type { ReactElement } from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SwapDistinctPairItem } from '@perawallet/wallet-core-swaps'
import { SwapEvent, AnalyticsMetadataKey } from '@analytics'
import { SwapHistoryContent } from '@modules/swap/components/SwapHistoryContent'
import { VISIBLE_SWAP_STATUSES } from '../../../constants'
import { useSwapPairHistoryWidget } from '../useSwapPairHistoryWidget'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

type Account = { chains: { algorand?: { address: string } } }

const {
    mockTrackEvent,
    mockSetFromAsset,
    mockSetToAsset,
    mockRequestBottomSheet,
    mockHistoryQuery,
    selection,
} = vi.hoisted(() => ({
    mockTrackEvent: vi.fn(),
    mockSetFromAsset: vi.fn(),
    mockSetToAsset: vi.fn(),
    mockRequestBottomSheet: vi.fn(),
    mockHistoryQuery: vi.fn(),
    selection: { account: null as Account | null },
}))

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackEvent: mockTrackEvent,
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwaps: () => ({
        setFromAsset: mockSetFromAsset,
        setToAsset: mockSetToAsset,
    }),
    useDistinctPairsHistoryQuery: mockHistoryQuery,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    addressOn: (account: Account) => account.chains.algorand?.address,
    useSelectedAccount: () => selection.account,
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequestBottomSheet }),
}))

vi.mock('@modules/swap/components/SwapHistoryContent', () => ({
    SwapHistoryContent: () => null,
}))

const ADDRESS = 'TESTADDRESS123'

const PAIR = {
    assetIn: { assetId: 0, unitName: 'ALGO' },
    assetOut: { assetId: 31_566_704, unitName: 'USDC' },
    swapDatetime: '2026-10-01T00:00:00Z',
    pairKey: '0-31566704',
} as unknown as SwapDistinctPairItem

describe('useSwapPairHistoryWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        selection.account = { chains: { algorand: { address: ADDRESS } } }
        mockHistoryQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: false,
        })
    })

    it('queries the visible swap pairs for the selected account', () => {
        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        expect(result.current.address).toBe(ADDRESS)
        expect(result.current.isEnabled).toBe(true)
        expect(mockHistoryQuery).toHaveBeenCalledWith(
            ADDRESS,
            SCOPE,
            VISIBLE_SWAP_STATUSES,
            true,
        )
    })

    it('disables the query when no account is selected', () => {
        selection.account = null

        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        expect(result.current.address).toBe('')
        expect(result.current.isEnabled).toBe(false)
        expect(mockHistoryQuery).toHaveBeenCalledWith(
            '',
            SCOPE,
            VISIBLE_SWAP_STATUSES,
            false,
        )
    })

    it('disables the query when the account has no address on the scope', () => {
        selection.account = { chains: {} }

        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        expect(result.current.address).toBe('')
        expect(result.current.isEnabled).toBe(false)
    })

    it('returns no pairs before the query has data', () => {
        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        expect(result.current.pairs).toEqual([])
    })

    it('passes through the pairs and query state', () => {
        mockHistoryQuery.mockReturnValue({
            data: [PAIR],
            isLoading: true,
            isError: true,
        })

        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        expect(result.current).toMatchObject({
            pairs: [PAIR],
            isLoading: true,
            isError: true,
        })
    })

    it('selects and tracks the pressed pair', () => {
        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        act(() => result.current.handlePairPress(PAIR))

        expect(mockSetFromAsset).toHaveBeenCalledWith('0')
        expect(mockSetToAsset).toHaveBeenCalledWith('31566704')
        expect(mockTrackEvent).toHaveBeenCalledWith(SwapEvent.SelectHistory, {
            [AnalyticsMetadataKey.ChainId]: 'algorand',
            [AnalyticsMetadataKey.SwapPairing]: 'ALGO/USDC',
        })
    })

    it('opens the full history sheet for the account on see all', () => {
        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        act(() => result.current.handleSeeAllPress())

        expect(mockTrackEvent).toHaveBeenCalledWith(SwapEvent.HistorySeeAll, {
            [AnalyticsMetadataKey.ChainId]: 'algorand',
        })
        const [request] = mockRequestBottomSheet.mock.calls[0] as [
            { contents: ReactElement; options: unknown },
        ]
        expect(request.contents.type).toBe(SwapHistoryContent)
        expect(request.contents.props).toEqual({
            scope: SCOPE,
            address: ADDRESS,
        })
        expect(request.options).toEqual({
            size: 'modal',
            enablePanDownToClose: true,
            autoCreateContainer: false,
        })
    })

    it('does nothing on see all without an address', () => {
        selection.account = null
        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        act(() => result.current.handleSeeAllPress())

        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
        expect(mockTrackEvent).not.toHaveBeenCalled()
    })
})
