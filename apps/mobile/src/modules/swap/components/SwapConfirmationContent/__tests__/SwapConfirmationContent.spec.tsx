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
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import type { SwapExecutionStatus } from '../../../hooks/useSwapExecution'
import { SwapConfirmationContent } from '../SwapConfirmationContent'

const { mockSwapExecute, mockSwapReset, mockSwapStatusRef } = vi.hoisted(
    () => ({
        mockSwapExecute: vi.fn(),
        mockSwapReset: vi.fn(),
        mockSwapStatusRef: { current: 'idle' as SwapExecutionStatus },
    }),
)

const { mockScheduleAfterDelay } = vi.hoisted(() => ({
    mockScheduleAfterDelay: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@hooks/useRunAfterDelay', () => ({
    useRunAfterDelay: () => ({
        schedule: mockScheduleAfterDelay,
        flush: vi.fn(),
    }),
}))

vi.mock('../../../hooks/useSwapExecution', () => ({
    useSwapExecution: () => ({
        execute: mockSwapExecute,
        reset: mockSwapReset,
        status: mockSwapStatusRef.current,
        error: null,
        txIds: [],
    }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    formatNumber: (value: Decimal) => ({
        sign: '',
        integer: value.toFixed(0),
        fraction: '',
    }),
    formatCurrency: (value: Decimal, _precision: number, currency: string) =>
        `${currency} ${value.toString()}`,
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useProvidersQuery: () => ({ data: undefined }),
    apiSlippageToPercent: (slippage: Decimal) => slippage.mul(100).toString(),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    formatAssetAmount: (amount: Decimal, asset: { unitName?: string }) =>
        `${amount.toString()} ${asset.unitName ?? ''}`.trim(),
    useAssetsQuery: () => ({ data: undefined }),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({
        preferredCurrency: 'USD',
        usdToPreferred: (value: Decimal) => value,
    }),
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
        assetId: '0',
        name: 'Algorand',
        unitName: 'ALGO',
        decimals: 6,
        verificationTier: 'verified',
    },
    assetOut: {
        assetId: '31566704',
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
    provider: 'tinyman',
    providerDisplayName: 'Tinyman',
    quoteIdStr: 'quote-1',
    ...overrides,
})

const renderWithId = (children: React.ReactNode, id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            {children}
        </BottomSheetIdContext.Provider>,
    )

describe('SwapConfirmationContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        vi.clearAllMocks()
        mockSwapStatusRef.current = 'idle'
    })

    it('renders pay and receive amounts', () => {
        renderWithId(<SwapConfirmationContent quote={createQuote()} />)
        expect(screen.getByText('1000000')).toBeDefined()
        expect(screen.getByText('150000')).toBeDefined()
    })

    it('renders quote details', () => {
        renderWithId(<SwapConfirmationContent quote={createQuote()} />)
        expect(screen.getByText('swap.quote.rate')).toBeDefined()
        expect(screen.getByText('swap.quote.provider')).toBeDefined()
        expect(screen.getByText('Tinyman')).toBeDefined()
        expect(screen.getByText('swap.quote.slippage_tolerance')).toBeDefined()
        expect(screen.getByText('swap.quote.price_impact')).toBeDefined()
        expect(screen.getByText('swap.quote.minimum_received')).toBeDefined()
        expect(screen.getByText('swap.quote.pera_fee')).toBeDefined()
    })

    it('renders slippage as a percent (5% from API fraction 0.05)', () => {
        const quote = createQuote({ slippage: new Decimal('0.05') })
        renderWithId(<SwapConfirmationContent quote={quote} />)
        expect(screen.getByText('5%')).toBeDefined()
    })

    it('renders pera fee using peraFeeAsset when it differs from assetIn', () => {
        const quote = createQuote({
            peraFeeAmount: new Decimal('1000'),
            peraFeeAsset: {
                assetId: '31566704',
                name: 'USDC',
                unitName: 'USDC',
                decimals: 6,
                verificationTier: 'verified',
            },
        })
        renderWithId(<SwapConfirmationContent quote={quote} />)
        expect(screen.getByText('1000 USDC')).toBeDefined()
    })

    it('falls back to assetIn for pera fee when peraFeeAsset is absent', () => {
        const quote = createQuote({
            peraFeeAmount: new Decimal('1000'),
            peraFeeAsset: undefined,
        })
        renderWithId(<SwapConfirmationContent quote={quote} />)
        expect(screen.getByText('1000 ALGO')).toBeDefined()
    })

    it('shows high price impact warning when priceImpact >= 5', () => {
        const quote = createQuote({ priceImpact: new Decimal('5.5') })
        renderWithId(<SwapConfirmationContent quote={quote} />)
        expect(screen.getByTestId('swap-confirm-warning')).toBeDefined()
        expect(
            screen.getByText('swap.quote.high_price_impact_warning'),
        ).toBeDefined()
    })

    it('hides warning when priceImpact < 5', () => {
        const quote = createQuote({ priceImpact: new Decimal('2') })
        renderWithId(<SwapConfirmationContent quote={quote} />)
        expect(screen.queryByTestId('swap-confirm-warning')).toBeNull()
    })

    it('calls swap execution when slide-to-confirm is triggered', async () => {
        mockSwapExecute.mockResolvedValueOnce(true)
        renderWithId(<SwapConfirmationContent quote={createQuote()} />)

        fireEvent.click(screen.getByTestId('swap-confirm-slide'))
        await Promise.resolve()
        expect(mockSwapExecute).toHaveBeenCalledWith('quote-1')
    })

    it('schedules resolution with confirm after successful swap', async () => {
        mockSwapExecute.mockResolvedValueOnce(true)
        renderWithId(<SwapConfirmationContent quote={createQuote()} />)

        fireEvent.click(screen.getByTestId('swap-confirm-slide'))
        await Promise.resolve()
        await Promise.resolve()
        expect(mockScheduleAfterDelay).toHaveBeenCalled()
    })

    it('does not schedule resolution when swap fails', async () => {
        mockSwapExecute.mockResolvedValueOnce(false)
        renderWithId(<SwapConfirmationContent quote={createQuote()} />)

        fireEvent.click(screen.getByTestId('swap-confirm-slide'))
        await Promise.resolve()
        await Promise.resolve()
        expect(mockScheduleAfterDelay).not.toHaveBeenCalled()
    })

    it('dismisses the sheet when close icon is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<'confirm'>({ id: 'sheet-1', contents: null })
        renderWithId(<SwapConfirmationContent quote={createQuote()} />)

        fireEvent.click(screen.getByTestId('swap-confirm-close'))
        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })

    it('marks the slide-to-confirm as loading while signing', () => {
        mockSwapStatusRef.current = 'signing'
        renderWithId(<SwapConfirmationContent quote={createQuote()} />)
        expect(
            screen
                .getByTestId('swap-confirm-slide')
                .getAttribute('data-loading'),
        ).toBe('true')
    })

    it('marks the slide-to-confirm as loading while submitting', () => {
        mockSwapStatusRef.current = 'submitting'
        renderWithId(<SwapConfirmationContent quote={createQuote()} />)
        expect(
            screen
                .getByTestId('swap-confirm-slide')
                .getAttribute('data-loading'),
        ).toBe('true')
    })

    it('marks the slide-to-confirm as confirmed on success', () => {
        mockSwapStatusRef.current = 'success'
        renderWithId(<SwapConfirmationContent quote={createQuote()} />)
        expect(
            screen
                .getByTestId('swap-confirm-slide')
                .getAttribute('data-confirmed'),
        ).toBe('true')
    })

    it('shows error banner on error status', () => {
        mockSwapStatusRef.current = 'error'
        renderWithId(<SwapConfirmationContent quote={createQuote()} />)
        expect(screen.getByTestId('swap-confirm-error')).toBeDefined()
        expect(screen.getByText('swap.execution.error')).toBeDefined()
    })

    it('shows account name in header', () => {
        renderWithId(<SwapConfirmationContent quote={createQuote()} />)
        expect(screen.getByText('Main Account')).toBeDefined()
    })
})
