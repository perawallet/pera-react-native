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
import { describe, it, expect, vi } from 'vitest'
import type { SwapHistoryItem } from '@perawallet/wallet-core-swaps'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@modules/assets/components/AssetIcon', () => ({
    AssetIcon: ({ asset }: { asset: { assetId: string } }) => (
        <span data-testid={`asset-icon-${asset.assetId}`} />
    ),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
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
}))

import { SwapHistoryList } from '../SwapHistoryList'

const makeItem = (id: number): SwapHistoryItem => ({
    id,
    idStr: `id-${id}`,
    provider: 'tinyman',
    status: 'completed',
    completedDatetime: '2024-01-01T00:00:00Z',
    transactionGroupId: `group-${id}`,
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

describe('SwapHistoryList', () => {
    it('renders error empty state when error and no swaps', () => {
        render(
            <SwapHistoryList
                swaps={[]}
                isLoading={false}
                isError={true}
                isFetchingNextPage={false}
                hasNextPage={false}
                onItemPress={vi.fn()}
                onEndReached={vi.fn()}
            />,
        )

        expect(screen.getByText('swap.history.list.error.title')).toBeDefined()
    })

    it('renders empty state when no swaps and not loading', () => {
        render(
            <SwapHistoryList
                swaps={[]}
                isLoading={false}
                isError={false}
                isFetchingNextPage={false}
                hasNextPage={false}
                onItemPress={vi.fn()}
                onEndReached={vi.fn()}
            />,
        )

        expect(screen.getByText('swap.history.list.empty.title')).toBeDefined()
    })

    it('renders items and calls onItemPress when tapped', () => {
        const onItemPress = vi.fn()
        const item = makeItem(1)

        render(
            <SwapHistoryList
                swaps={[item]}
                isLoading={false}
                isError={false}
                isFetchingNextPage={false}
                hasNextPage={false}
                onItemPress={onItemPress}
                onEndReached={vi.fn()}
            />,
        )

        fireEvent.click(screen.getByTestId('swap-history-item-1'))

        expect(onItemPress).toHaveBeenCalledWith(item)
    })
})
