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
import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { SwapQuoteDetails } from '../SwapQuoteDetails'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    DEFAULT_PRECISION: 2,
    formatNumber: (
        value: Decimal,
        maxPrecision: number,
        _locale?: string,
        minPrecision?: number,
    ) => {
        const str = value.toFixed(minPrecision ?? maxPrecision)
        const [integer, fraction] = str.split('.')
        return {
            sign: '',
            integer,
            fraction: fraction ? `.${fraction}` : '',
        }
    },
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET: { decimals: 6 },
    formatAssetAmount: (amount: Decimal, asset: { unitName?: string }) =>
        `${amount.toString()} ${asset.unitName ?? ''}`.trim(),
}))

vi.mock('@perawallet/wallet-core-remote-config', () => ({
    RemoteConfigKeys: {
        swap_price_impact_low_threshold: 'swap_price_impact_low_threshold',
        swap_price_impact_high_threshold: 'swap_price_impact_high_threshold',
    },
    useRemoteConfig: () => ({
        getNumberValue: (key: string) => {
            if (key === 'swap_price_impact_low_threshold') return 1
            if (key === 'swap_price_impact_high_threshold') return 5
            return 0
        },
    }),
}))

vi.mock('@components/core', () => ({
    PWView: ({
        children,
        testID,
    }: {
        children: React.ReactNode
        testID?: string
    }) => <div data-testid={testID}>{children}</div>,
    PWText: ({
        children,
        style,
    }: {
        children: React.ReactNode
        style?: unknown
        variant?: string
    }) => <span style={style as React.CSSProperties}>{children}</span>,
    PWSkeleton: () => <div data-testid='skeleton' />,
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
    price: new Decimal('0.15'),
    priceImpact: new Decimal('0.5'),
    slippage: new Decimal('0.5'),
    peraFeeAmount: new Decimal('1000'),
    provider: 'tinyman',
    providerDisplayName: 'Tinyman',
    ...overrides,
})

describe('SwapQuoteDetails', () => {
    it('renders rate, price impact, slippage, fees, and provider', () => {
        const quote = createQuote()
        render(<SwapQuoteDetails quote={quote} />)

        expect(screen.getByText(/swap.quote.rate/)).toBeDefined()
        expect(screen.getByText(/swap.quote.price_impact/)).toBeDefined()
        expect(screen.getByText(/swap.quote.slippage_tolerance/)).toBeDefined()
        expect(screen.getByText(/swap.quote.pera_fee/)).toBeDefined()
        expect(screen.getByText(/swap.quote.provider/)).toBeDefined()
        expect(screen.getByText('Tinyman')).toBeDefined()
    })

    it('shows skeleton loaders when isLoading is true', () => {
        const quote = createQuote()
        render(
            <SwapQuoteDetails
                quote={quote}
                isLoading
            />,
        )

        const skeletons = screen.getAllByTestId('skeleton')
        expect(skeletons.length).toBe(5)
    })

    it('displays dash for missing optional fields', () => {
        const quote = createQuote({
            priceImpact: undefined,
            slippage: undefined,
            peraFeeAmount: undefined,
            provider: undefined,
            providerDisplayName: undefined,
        })
        render(<SwapQuoteDetails quote={quote} />)

        const dashes = screen.getAllByText('-')
        expect(dashes.length).toBeGreaterThanOrEqual(4)
    })

    it('falls back to raw provider name when displayName is missing', () => {
        const quote = createQuote({
            provider: 'deflex',
            providerDisplayName: undefined,
        })
        render(<SwapQuoteDetails quote={quote} />)

        expect(screen.getByText('deflex')).toBeDefined()
    })

    it('renders container with testID', () => {
        const quote = createQuote()
        render(<SwapQuoteDetails quote={quote} />)

        expect(screen.getByTestId('swap-quote-details')).toBeDefined()
    })
})
