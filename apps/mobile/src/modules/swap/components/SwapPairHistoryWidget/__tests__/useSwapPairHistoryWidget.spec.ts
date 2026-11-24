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
import type { SwapHistoryPair } from '@perawallet/wallet-core-swaps'
import { SwapEvent, AnalyticsMetadataKey } from '@analytics'
import { SwapHistoryContent } from '@modules/swap/components/SwapHistoryContent'
import { useSwapPairHistoryWidget } from '../useSwapPairHistoryWidget'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

type Account = { id: string; name: string }

const {
    mockTrackEvent,
    mockSetAccountPair,
    mockSetSelectedAccountId,
    mockRequestBottomSheet,
    state,
} = vi.hoisted(() => ({
    mockTrackEvent: vi.fn(),
    mockSetAccountPair: vi.fn(),
    mockSetSelectedAccountId: vi.fn(),
    mockRequestBottomSheet: vi.fn(),
    state: {
        accounts: [] as Account[],
        recent: {
            pairs: [] as SwapHistoryPair[],
            isLoading: false,
            isError: false,
            isEnabled: true,
        },
    },
}))

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackEvent: mockTrackEvent,
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwapsStore: (select: (store: unknown) => unknown) =>
        select({ setAccountPair: mockSetAccountPair }),
    useRecentSwapPairsQuery: () => state.recent,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    getAccountDisplayName: (account: Account | null) =>
        account?.name ?? 'No Account',
    useAllAccounts: () => state.accounts,
    useSelectedAccountId: () => ({
        setSelectedAccountId: mockSetSelectedAccountId,
    }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequestBottomSheet }),
}))

vi.mock('@modules/swap/components/SwapHistoryContent', () => ({
    SwapHistoryContent: () => null,
}))

const ADDRESS = 'TESTADDRESS123'
const MAIN: Account = { id: 'main', name: 'Main' }
const OTHER: Account = { id: 'other', name: 'Savings' }

const assetOn = (assetId: string, unitName: string) => ({
    assetId,
    ref: { ...SCOPE, assetId },
    unitName,
})

const pairPaidBy = (accountId: string) =>
    ({
        assetIn: assetOn('0', 'ALGO'),
        assetOut: assetOn('31566704', 'USDC'),
        sourceAccount: { scope: SCOPE, address: ADDRESS },
        swapDatetime: '2026-10-01T00:00:00Z',
        pairKey: 'algorand/0|algorand/31566704',
        accountId,
    }) as unknown as SwapHistoryPair

describe('useSwapPairHistoryWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        state.accounts = [MAIN, OTHER]
        state.recent = {
            pairs: [],
            isLoading: false,
            isError: false,
            isEnabled: true,
        }
    })

    it('passes through the recent pairs and their state', () => {
        const pair = pairPaidBy('main')
        state.recent = {
            pairs: [pair],
            isLoading: true,
            isError: true,
            isEnabled: false,
        }

        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        expect(result.current).toMatchObject({
            pairs: [pair],
            isLoading: true,
            isError: true,
            isEnabled: false,
        })
    })

    it('restores the pair on the account that paid for it, leaving the selected account', () => {
        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        act(() => result.current.handlePairPress(pairPaidBy('other')))

        expect(mockSetAccountPair).toHaveBeenCalledWith({
            accountId: 'other',
            chainId: 'algorand',
            fromAsset: '0',
            toAsset: '31566704',
        })
        expect(mockSetSelectedAccountId).not.toHaveBeenCalled()
        expect(mockTrackEvent).toHaveBeenCalledWith(SwapEvent.SelectHistory, {
            [AnalyticsMetadataKey.ChainId]: 'algorand',
            [AnalyticsMetadataKey.SwapPairing]: 'ALGO/USDC',
        })
    })

    it('opens the full history sheet on see all', () => {
        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        act(() => result.current.handleSeeAllPress())

        expect(mockTrackEvent).toHaveBeenCalledWith(SwapEvent.HistorySeeAll, {
            [AnalyticsMetadataKey.ChainId]: 'algorand',
        })
        const [request] = mockRequestBottomSheet.mock.calls[0] as [
            { contents: ReactElement; options: unknown },
        ]
        expect(request.contents.type).toBe(SwapHistoryContent)
        expect(request.contents.props).toEqual({})
        expect(request.options).toEqual({
            size: 'modal',
            enablePanDownToClose: true,
            autoCreateContainer: false,
        })
    })

    it('names the account that paid on each chip', () => {
        const { result } = renderHook(() => useSwapPairHistoryWidget(SCOPE))

        const chip = result.current.renderPair({
            item: pairPaidBy('other'),
        }) as ReactElement<{ accountName: string }>

        expect(chip.props.accountName).toBe('Savings')
    })
})
