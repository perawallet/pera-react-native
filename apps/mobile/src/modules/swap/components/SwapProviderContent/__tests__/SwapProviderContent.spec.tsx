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
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { SwapProviderContent } from '../SwapProviderContent'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    formatAssetAmount: (amount: Decimal, asset: { unitName?: string }) =>
        `${amount.toString()} ${asset.unitName ?? ''}`.trim(),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({
        preferredCurrency: 'USD',
        usdToPreferred: (value: Decimal) => value,
    }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    formatCurrency: (value: Decimal, _precision: number, currency: string) =>
        `${currency} ${value.toString()}`,
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useProvidersQuery: () => ({
        data: [
            {
                name: 'vestige',
                displayName: 'Vestige.fi',
                iconUrl: 'https://example.com/vestige.png',
            },
            {
                name: 'tinyman',
                displayName: 'Tinyman',
                iconUrl: 'https://example.com/tinyman.png',
            },
        ],
    }),
}))

vi.mock('@components/core', () => ({
    PWToolbar: ({
        left,
        center,
        right,
    }: {
        left: React.ReactNode
        center: React.ReactNode
        right: React.ReactNode
    }) => (
        <div>
            {left}
            {center}
            {right}
        </div>
    ),
    PWIcon: ({ name, onPress }: { name: string; onPress?: () => void }) => (
        <button
            data-testid={`icon-${name}`}
            onClick={onPress}
        />
    ),
    PWImage: () => <div data-testid='provider-image' />,
    PWText: ({
        children,
        style,
    }: {
        children?: React.ReactNode
        style?: unknown
    }) => <span style={style as React.CSSProperties}>{children}</span>,
    PWTouchableOpacity: ({
        children,
        onPress,
        testID,
        style,
    }: {
        children?: React.ReactNode
        onPress?: () => void
        testID?: string
        style?: unknown
    }) => (
        <button
            data-testid={testID}
            onClick={onPress}
            style={style as React.CSSProperties}
        >
            {children}
        </button>
    ),
    PWRadioButton: ({
        children,
        onPress,
        testID,
        containerStyle,
        isSelected,
    }: {
        children?: React.ReactNode
        onPress?: () => void
        testID?: string
        containerStyle?: unknown
        isSelected?: boolean
    }) => (
        <button
            data-testid={testID}
            onClick={onPress}
            style={containerStyle as React.CSSProperties}
        >
            {children}
            <div data-testid={testID ? `${testID}-radio` : undefined}>
                {isSelected ? <div /> : null}
            </div>
        </button>
    ),
    PWView: ({
        children,
        style,
        testID,
    }: {
        children?: React.ReactNode
        style?: unknown
        testID?: string
    }) => (
        <div
            data-testid={testID}
            style={style as React.CSSProperties}
        >
            {children}
        </div>
    ),
}))

const createQuote = (overrides: Partial<SwapQuote> = {}): SwapQuote => ({
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
    amountOut: new Decimal('600.08'),
    amountOutUsdValue: '600.08',
    provider: 'vestige',
    providerDisplayName: 'Vestige.fi',
    ...overrides,
})

const renderWithId = (children: React.ReactNode, id = 'sheet-1') =>
    render(
        <BottomSheetIdContext.Provider value={id}>
            {children}
        </BottomSheetIdContext.Provider>,
    )

describe('SwapProviderContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
    })

    it('renders Auto row and excludes the best-price quote from the list', () => {
        renderWithId(
            <SwapProviderContent
                quotes={[
                    createQuote({
                        provider: 'vestige',
                        amountOut: new Decimal('600.08'),
                    }),
                    createQuote({
                        provider: 'tinyman',
                        providerDisplayName: 'Tinyman',
                        amountOut: new Decimal('598'),
                    }),
                ]}
                selectedProviderName={null}
            />,
        )

        expect(screen.getByTestId('swap-provider-option-auto')).toBeDefined()
        expect(screen.getByTestId('swap-provider-option-tinyman')).toBeDefined()
        expect(screen.queryByTestId('swap-provider-option-vestige')).toBeNull()
    })

    it('auto row is marked selected when selectedProviderName is null', () => {
        renderWithId(
            <SwapProviderContent
                quotes={[createQuote()]}
                selectedProviderName={null}
            />,
        )

        expect(
            screen.getByTestId('swap-provider-option-auto-radio').children
                .length,
        ).toBeGreaterThan(0)
    })

    it('resolves with the selected provider when Apply is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<Nullable<string>>({ id: 'sheet-1', contents: null })
        renderWithId(
            <SwapProviderContent
                quotes={[
                    createQuote({
                        provider: 'vestige',
                        amountOut: new Decimal('600.08'),
                    }),
                    createQuote({
                        provider: 'tinyman',
                        amountOut: new Decimal('598'),
                    }),
                ]}
                selectedProviderName={null}
            />,
        )

        fireEvent.click(screen.getByTestId('swap-provider-option-tinyman'))
        fireEvent.click(screen.getByTestId('swap-provider-apply'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBe('tinyman')
    })

    it('Apply with Auto selected resolves with null', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<Nullable<string>>({ id: 'sheet-1', contents: null })
        renderWithId(
            <SwapProviderContent
                quotes={[createQuote({ provider: 'vestige' })]}
                selectedProviderName='vestige'
            />,
        )

        fireEvent.click(screen.getByTestId('swap-provider-option-auto'))
        fireEvent.click(screen.getByTestId('swap-provider-apply'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeNull()
    })

    it('renders quotes without a provider name and resolves with null when selected', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<Nullable<string>>({ id: 'sheet-1', contents: null })
        renderWithId(
            <SwapProviderContent
                quotes={[
                    createQuote({
                        provider: 'vestige',
                        amountOut: new Decimal('600.08'),
                    }),
                    createQuote({
                        provider: undefined,
                        providerDisplayName: undefined,
                        amountOut: new Decimal('598'),
                    }),
                ]}
                selectedProviderName={null}
            />,
        )

        fireEvent.click(screen.getByTestId('swap-provider-option-unknown'))
        fireEvent.click(screen.getByTestId('swap-provider-apply'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeNull()
    })

    it('renders provider rows ordered by amountOut descending', () => {
        renderWithId(
            <SwapProviderContent
                quotes={[
                    createQuote({
                        provider: 'tinyman',
                        amountOut: new Decimal('599.5608'),
                    }),
                    createQuote({
                        provider: 'folks',
                        amountOut: new Decimal('598.6542'),
                    }),
                    createQuote({
                        provider: 'vestige',
                        amountOut: new Decimal('600.0856'),
                    }),
                ]}
                selectedProviderName={null}
            />,
        )

        const providerButtons = screen
            .getAllByRole('button')
            .map(button => button.getAttribute('data-testid') ?? '')
            .filter(id => id.startsWith('swap-provider-option-'))
            .filter(id => !id.endsWith('-radio'))
            .filter(id => id !== 'swap-provider-option-auto')

        expect(providerButtons).toEqual([
            'swap-provider-option-tinyman',
            'swap-provider-option-folks',
        ])
    })

    it('dismisses the sheet when the cross icon is pressed', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<Nullable<string>>({ id: 'sheet-1', contents: null })
        renderWithId(
            <SwapProviderContent
                quotes={[]}
                selectedProviderName={null}
            />,
        )

        fireEvent.click(screen.getByTestId('icon-cross'))

        useBottomSheetStore.getState().remove('sheet-1')
        await expect(promise).resolves.toBeUndefined()
    })
})
