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
import type { SwapExecutionStatus } from '../../../hooks/useSwapExecution'

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

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useProvidersQuery: () => ({ data: undefined }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    formatAssetAmount: (amount: Decimal, asset: { unitName?: string }) =>
        `${amount.toString()} ${asset.unitName ?? ''}`.trim(),
    useAssetsQuery: () => ({ data: undefined }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => ({
        address: 'TESTADDRESS123',
        name: 'Main Account',
    }),
}))

vi.mock('@modules/accounts/components/AccountDisplay', () => ({
    AccountDisplay: ({
        account,
    }: {
        account?: { name?: string; address?: string }
    }) => (
        <div data-testid='account-display'>
            <span>{account?.name}</span>
            <span>{account?.address}</span>
        </div>
    ),
}))

vi.mock('@modules/assets/components/AssetIcon', () => ({
    AssetIcon: () => <div data-testid='asset-icon' />,
}))

vi.mock('@modules/assets/utils/verification', () => ({
    getVerificationIcon: (tier: string) =>
        tier === 'verified' ? 'assets/verified' : null,
}))

vi.mock('@components/InfoButton/InfoButton', () => ({
    InfoButton: ({ children }: { children: React.ReactNode }) => (
        <div data-testid='info-button'>{children}</div>
    ),
}))

vi.mock('@components/CurrencyDisplay/CurrencyDisplay', () => ({
    CurrencyDisplay: ({
        value,
        currency,
    }: {
        value: unknown
        currency: string
    }) => <span data-testid='currency-display'>{`${currency} ${value}`}</span>,
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
    PWImage: () => <div data-testid='pw-image' />,
    PWSlideToConfirm: ({
        title,
        onConfirm,
        testID,
        isLoading,
        isConfirmed,
    }: {
        title: string
        onConfirm: () => void
        testID?: string
        isLoading?: boolean
        isConfirmed?: boolean
        style?: unknown
    }) => (
        <button
            data-testid={testID}
            onClick={onConfirm}
            data-loading={isLoading}
            data-confirmed={isConfirmed}
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
    amountOutWithSlippage: new Decimal('149250'),
    price: new Decimal('0.15'),
    priceImpact: new Decimal('0.5'),
    slippage: new Decimal('0.5'),
    peraFeeAmount: new Decimal('1000'),
    exchangeFeeAmount: new Decimal('2000'),
    provider: 'tinyman',
    providerDisplayName: 'Tinyman',
    ...overrides,
})

describe('SwapConfirmationBottomSheet', () => {
    const defaultProps = {
        isVisible: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        quote: createQuote(),
        swapStatus: 'idle' as SwapExecutionStatus,
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

        expect(screen.getByText('1000000')).toBeDefined()
        expect(screen.getByText('150000')).toBeDefined()
    })

    it('renders quote details', () => {
        render(<SwapConfirmationBottomSheet {...defaultProps} />)

        expect(screen.getByText('swap.quote.rate')).toBeDefined()
        expect(screen.getByText('swap.quote.provider')).toBeDefined()
        expect(screen.getByText('Tinyman')).toBeDefined()
        expect(screen.getByText('swap.quote.slippage_tolerance')).toBeDefined()
        expect(screen.getByText('swap.quote.price_impact')).toBeDefined()
        expect(screen.getByText('swap.quote.minimum_received')).toBeDefined()
        expect(screen.getByText('swap.quote.exchange_fee')).toBeDefined()
        expect(screen.getByText('swap.quote.pera_fee')).toBeDefined()
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

        fireEvent.click(screen.getByTestId('swap-confirm-slide'))
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

    it('marks the slide-to-confirm as loading while signing', () => {
        render(
            <SwapConfirmationBottomSheet
                {...defaultProps}
                swapStatus='signing'
            />,
        )

        expect(
            screen
                .getByTestId('swap-confirm-slide')
                .getAttribute('data-loading'),
        ).toBe('true')
    })

    it('marks the slide-to-confirm as loading while submitting', () => {
        render(
            <SwapConfirmationBottomSheet
                {...defaultProps}
                swapStatus='submitting'
            />,
        )

        expect(
            screen
                .getByTestId('swap-confirm-slide')
                .getAttribute('data-loading'),
        ).toBe('true')
    })

    it('marks the slide-to-confirm as confirmed on success', () => {
        render(
            <SwapConfirmationBottomSheet
                {...defaultProps}
                swapStatus='success'
            />,
        )

        expect(
            screen
                .getByTestId('swap-confirm-slide')
                .getAttribute('data-confirmed'),
        ).toBe('true')
    })

    it('shows error banner on error status', () => {
        render(
            <SwapConfirmationBottomSheet
                {...defaultProps}
                swapStatus='error'
            />,
        )

        expect(screen.getByTestId('swap-confirm-error')).toBeDefined()
        expect(screen.getByText('swap.execution.error')).toBeDefined()
    })

    it('shows account name in header', () => {
        render(<SwapConfirmationBottomSheet {...defaultProps} />)

        expect(screen.getByText('Main Account')).toBeDefined()
    })
})
