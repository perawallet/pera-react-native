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
import { describe, it, expect, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import { SwapProviderRow } from '../SwapProviderRow'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    formatNumber: (value: Decimal) => ({
        sign: '',
        integer: value.toFixed(2).split('.')[0],
        fraction: `.${value.toFixed(2).split('.')[1] ?? '00'}`,
    }),
}))

vi.mock('../../SwapProviderDisplay', () => ({
    SwapProviderDisplay: ({
        providerDisplayName,
    }: {
        providerDisplayName?: string
    }) => <span data-testid='provider-display'>{providerDisplayName}</span>,
}))

vi.mock('@components/core', () => ({
    PWView: ({
        children,
        style,
    }: {
        children?: React.ReactNode
        style?: unknown
    }) => <div style={style as React.CSSProperties}>{children}</div>,
    PWText: ({ children }: { children?: React.ReactNode }) => (
        <span>{children}</span>
    ),
    PWIcon: ({ name }: { name: string }) => (
        <span data-testid={`icon-${name}`} />
    ),
    PWTouchableOpacity: ({
        children,
        onPress,
        testID,
    }: {
        children?: React.ReactNode
        onPress?: () => void
        testID?: string
    }) => (
        <button
            data-testid={testID}
            onClick={onPress}
        >
            {children}
        </button>
    ),
}))

const createQuote = (overrides: Partial<SwapQuote> = {}): SwapQuote => ({
    assetIn: {
        assetId: 0,
        unitName: 'ALGO',
        decimals: 6,
        verificationTier: 'verified',
    },
    assetOut: {
        assetId: 31566704,
        unitName: 'USDC',
        decimals: 6,
        verificationTier: 'verified',
    },
    price: new Decimal('0.33'),
    provider: 'vestige',
    providerDisplayName: 'Vestige.fi',
    ...overrides,
})

describe('SwapProviderRow', () => {
    it('renders the auto title when selectionMode is auto', () => {
        render(
            <SwapProviderRow
                quote={createQuote()}
                selectionMode='auto'
                onPress={vi.fn()}
            />,
        )

        expect(screen.getByText('swap.provider.title_auto')).toBeDefined()
    })

    it('renders the manual title when selectionMode is manual', () => {
        render(
            <SwapProviderRow
                quote={createQuote()}
                selectionMode='manual'
                onPress={vi.fn()}
            />,
        )

        expect(screen.getByText('swap.provider.title_manual')).toBeDefined()
    })

    it('renders the quote rate', () => {
        render(
            <SwapProviderRow
                quote={createQuote()}
                selectionMode='auto'
                onPress={vi.fn()}
            />,
        )

        expect(screen.getByText(/1 ALGO/)).toBeDefined()
        expect(screen.getByText(/USDC/)).toBeDefined()
    })

    it('renders a dash rate when quote price is missing', () => {
        render(
            <SwapProviderRow
                quote={createQuote({ price: undefined })}
                selectionMode='auto'
                onPress={vi.fn()}
            />,
        )

        expect(screen.getByText('-')).toBeDefined()
    })

    it('calls onPress when the row is tapped', () => {
        const onPress = vi.fn()
        render(
            <SwapProviderRow
                quote={createQuote()}
                selectionMode='auto'
                onPress={onPress}
            />,
        )

        fireEvent.click(screen.getByTestId('swap-provider-row'))

        expect(onPress).toHaveBeenCalled()
    })
})
