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
import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { SwapConfirmationBottomSheet } from '../SwapConfirmationBottomSheet'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    formatNumber: (value: Decimal) => ({
        sign: '',
        integer: value.toFixed(0),
        fraction: '',
    }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    formatAssetAmount: (amount: Decimal, asset: { unitName?: string }) =>
        `${amount.toString()} ${asset.unitName ?? ''}`.trim(),
}))

vi.mock('@components/core', () => ({
    PWBottomSheet: ({
        children,
        isVisible,
    }: {
        children: React.ReactNode
        isVisible: boolean
    }) => (isVisible ? <div data-testid='bottom-sheet'>{children}</div> : null),
    PWToolbar: ({
        left,
        center,
    }: {
        left: React.ReactNode
        center: React.ReactNode
    }) => (
        <div>
            {left}
            {center}
        </div>
    ),
    PWView: ({
        children,
        testID,
    }: {
        children: React.ReactNode
        testID?: string
        style?: unknown
    }) => <div data-testid={testID}>{children}</div>,
    PWText: ({
        children,
    }: {
        children: React.ReactNode
        style?: unknown
        variant?: string
    }) => <span>{children}</span>,
    PWIcon: ({
        onPress,
        testID,
    }: {
        onPress?: () => void
        testID?: string
        name?: string
        size?: string
    }) => (
        <button
            data-testid={testID}
            onClick={onPress}
        />
    ),
    PWDivider: () => <hr />,
    PWButton: ({
        title,
        onPress,
        testID,
    }: {
        title: string
        onPress: () => void
        testID?: string
        variant?: string
        isLoading?: boolean
        style?: unknown
    }) => (
        <button
            data-testid={testID}
            onClick={onPress}
        >
            {title}
        </button>
    ),
}))

const createQuote = (overrides: Partial<SwapQuote> = {}): SwapQuote => ({
    assetIn: {
        assetId: 0,
        name: 'Algorand',
        unitName: 'ALGO',
        decimals: 6,
        verificationTier: 'verified',
    },
    assetOut: {
        assetId: 31566704,
        name: 'USDC',
        unitName: 'USDC',
        decimals: 6,
        verificationTier: 'verified',
    },
    amountIn: new Decimal('1000000'),
    amountOut: new Decimal('150000'),
    price: new Decimal('0.15'),
    priceImpact: new Decimal('0.5'),
    slippage: new Decimal('0.5'),
    peraFeeAmount: new Decimal('1000'),
    exchangeFeeAmount: new Decimal('2000'),
    provider: 'Tinyman',
    ...overrides,
})

describe('SwapConfirmationBottomSheet', () => {
    const defaultProps = {
        isVisible: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        quote: createQuote(),
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns null when quote is null', () => {
        const { container } = render(
            <SwapConfirmationBottomSheet
                {...defaultProps}
                quote={null}
            />,
        )

        expect(container.innerHTML).toBe('')
    })

    it('renders pay and receive amounts', () => {
        render(<SwapConfirmationBottomSheet {...defaultProps} />)

        expect(screen.getByText(/1000000 ALGO/)).toBeDefined()
        expect(screen.getByText(/150000 USDC/)).toBeDefined()
    })

    it('shows high price impact warning when priceImpact >= 5', () => {
        const quote = createQuote({ priceImpact: new Decimal('5.5') })
        render(
            <SwapConfirmationBottomSheet
                {...defaultProps}
                quote={quote}
            />,
        )

        expect(screen.getByTestId('swap-confirm-warning')).toBeDefined()
        expect(
            screen.getByText('swap.quote.high_price_impact_warning'),
        ).toBeDefined()
    })

    it('hides warning when priceImpact < 5', () => {
        const quote = createQuote({ priceImpact: new Decimal('2') })
        render(
            <SwapConfirmationBottomSheet
                {...defaultProps}
                quote={quote}
            />,
        )

        expect(screen.queryByTestId('swap-confirm-warning')).toBeNull()
    })

    it('calls onConfirm when confirm button is pressed', () => {
        const onConfirm = vi.fn()
        render(
            <SwapConfirmationBottomSheet
                {...defaultProps}
                onConfirm={onConfirm}
            />,
        )

        fireEvent.click(screen.getByTestId('swap-confirm-button'))
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when close icon is pressed', () => {
        const onClose = vi.fn()
        render(
            <SwapConfirmationBottomSheet
                {...defaultProps}
                onClose={onClose}
            />,
        )

        fireEvent.click(screen.getByTestId('swap-confirm-close'))
        expect(onClose).toHaveBeenCalledTimes(1)
    })
})
