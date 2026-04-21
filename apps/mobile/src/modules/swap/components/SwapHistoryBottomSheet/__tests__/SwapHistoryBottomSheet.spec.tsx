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

import React from 'react'
import { Decimal } from 'decimal.js'
import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SwapHistoryItem } from '@perawallet/wallet-core-swaps'

const mockPushWebView = vi.fn()
const mockFetchNextPage = vi.fn()
const mockUseSwapHistoryInfiniteQuery = vi.fn()

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({
        networkConfig: { explorerUrl: 'https://explorer.example' },
    }),
    baseUnitsToDisplayUnits: (amount: Decimal, decimals: number) =>
        amount.div(new Decimal(10).pow(decimals)),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    DEFAULT_PRECISION: 2,
    formatNumber: (value: Decimal) => ({
        sign: '',
        integer: value.toFixed(0),
        fraction: '',
    }),
    formatDatetime: () => 'Jan 1, 2024',
    generateUniqueId: () => 'uid',
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwapHistoryInfiniteQuery: (...args: unknown[]) =>
        mockUseSwapHistoryInfiniteQuery(...args),
}))

vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@modules/assets/components/AssetIcon', () => ({
    AssetIcon: ({ asset }: { asset: { assetId: string } }) => (
        <span data-testid={`asset-icon-${asset.assetId}`} />
    ),
}))

import { SwapHistoryBottomSheet } from '../SwapHistoryBottomSheet'

const makeItem = (id: number, groupId: string | null): SwapHistoryItem => ({
    id,
    idStr: `id-${id}`,
    provider: 'tinyman',
    status: 'completed',
    completedDatetime: '2024-01-01T00:00:00Z',
    transactionGroupId: groupId,
    assetIn: {
        assetId: '0',
        unitName: 'ALGO',
        decimals: 6,
        verificationTier: 'verified',
    },
    assetOut: {
        assetId: '31566704',
        unitName: 'USDC',
        decimals: 6,
        verificationTier: 'verified',
    },
    amountIn: new Decimal(1_000_000),
    amountOut: new Decimal(2_000_000),
})

describe('SwapHistoryBottomSheet', () => {
    beforeEach(() => {
        mockPushWebView.mockReset()
        mockFetchNextPage.mockReset()
        mockUseSwapHistoryInfiniteQuery.mockReset()
    })

    it('renders the history list and title when visible', () => {
        mockUseSwapHistoryInfiniteQuery.mockReturnValue({
            swaps: [makeItem(1, 'GROUP-1')],
            isLoading: false,
            isError: false,
            isFetchingNextPage: false,
            hasNextPage: false,
            fetchNextPage: mockFetchNextPage,
        })

        render(
            <SwapHistoryBottomSheet
                isVisible
                address='ADDRESS'
                onClose={vi.fn()}
            />,
        )

        expect(screen.getByText('swap.history.title')).toBeDefined()
        expect(screen.getByTestId('swap-history-item-1')).toBeDefined()
    })

    it('closes the sheet and opens the explorer when an item is tapped', () => {
        const onClose = vi.fn()
        mockUseSwapHistoryInfiniteQuery.mockReturnValue({
            swaps: [makeItem(42, 'GROUP-42')],
            isLoading: false,
            isError: false,
            isFetchingNextPage: false,
            hasNextPage: false,
            fetchNextPage: mockFetchNextPage,
        })

        render(
            <SwapHistoryBottomSheet
                isVisible
                address='ADDRESS'
                onClose={onClose}
            />,
        )

        fireEvent.click(screen.getByTestId('swap-history-item-42'))

        expect(onClose).toHaveBeenCalled()
        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://explorer.example/tx-group/GROUP-42/',
            id: 'uid',
        })
    })

    it('renders the empty state when there are no swaps', () => {
        mockUseSwapHistoryInfiniteQuery.mockReturnValue({
            swaps: [],
            isLoading: false,
            isError: false,
            isFetchingNextPage: false,
            hasNextPage: false,
            fetchNextPage: mockFetchNextPage,
        })

        render(
            <SwapHistoryBottomSheet
                isVisible
                address='ADDRESS'
                onClose={vi.fn()}
            />,
        )

        expect(screen.getByText('swap.history.list.empty.title')).toBeDefined()
    })
})
