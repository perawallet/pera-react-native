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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { SwapProviderItem, SwapQuote } from '@perawallet/wallet-core-swaps'
import { SwapEvent, AnalyticsMetadataKey } from '@analytics'
import { useSwapProviderContent } from '../useSwapProviderContent'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const { mockTrackEvent, mockProviders } = vi.hoisted(() => ({
    mockTrackEvent: vi.fn(),
    mockProviders: { data: undefined as SwapProviderItem[] | undefined },
}))

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackEvent: mockTrackEvent,
}))

vi.mock('@perawallet/wallet-core-swaps', async () => ({
    sortQuotesByAmountOutDesc: (
        await vi.importActual<
            typeof import('@packages/swaps/src/utils/swapQuoteHelpers')
        >('@packages/swaps/src/utils/swapQuoteHelpers')
    ).sortQuotesByAmountOutDesc,
    useProvidersQuery: () => mockProviders,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    formatAssetAmount: (amount: { toString: () => string }) =>
        `${amount.toString()} USDC`,
}))

const USDC = { assetId: '31566704', unitName: 'USDC', decimals: 6 }

const makeQuote = (overrides: Partial<SwapQuote>): SwapQuote =>
    ({ assetIn: USDC, assetOut: USDC, ...overrides }) as SwapQuote

const BEST = makeQuote({ provider: 'best', amountOut: new Decimal('300') })

const renderContent = (
    quotes: SwapQuote[],
    selectedProviderName: string | null = null,
) =>
    renderHook(() =>
        useSwapProviderContent({ scope: SCOPE, quotes, selectedProviderName }),
    )

describe('useSwapProviderContent', () => {
    beforeEach(() => {
        mockTrackEvent.mockClear()
        mockProviders.data = undefined
        vi.mocked(useCurrency).mockReturnValue({
            preferredCurrency: 'USD',
            usdToPreferred: (usd: Decimal) => usd.mul(2),
        } as unknown as ReturnType<typeof useCurrency>)
    })

    it('starts from the selected provider', () => {
        const { result } = renderContent([], 'tinyman')

        expect(result.current.userSelection).toBe('tinyman')
    })

    it('records and tracks a provider selection', () => {
        const { result } = renderContent([], null)

        act(() => result.current.handleSelect('vestige'))

        expect(result.current.userSelection).toBe('vestige')
        expect(mockTrackEvent).toHaveBeenCalledWith(
            SwapEvent.SelectProviderRouter,
            {
                [AnalyticsMetadataKey.ChainId]: 'algorand',
                [AnalyticsMetadataKey.RouterName]: 'vestige',
            },
        )
    })

    it('tracks the auto route without a router name', () => {
        const { result } = renderContent([], 'vestige')

        act(() => result.current.handleSelect(null))

        expect(result.current.userSelection).toBeNull()
        expect(mockTrackEvent).toHaveBeenCalledWith(
            SwapEvent.SelectProviderRouter,
            {
                [AnalyticsMetadataKey.ChainId]: 'algorand',
                [AnalyticsMetadataKey.RouterName]: undefined,
            },
        )
    })

    it('lists the alternatives best first, leaving out the top quote', () => {
        const low = makeQuote({
            provider: 'low',
            amountOut: new Decimal('100'),
        })
        const mid = makeQuote({
            provider: 'mid',
            amountOut: new Decimal('200'),
        })

        const { result } = renderContent([low, BEST, mid])

        expect(result.current.rows.map(row => row.quote)).toEqual([mid, low])
    })

    it('has no rows when only one quote came back', () => {
        const { result } = renderContent([BEST])

        expect(result.current.rows).toEqual([])
    })

    it('prefers the quote display name over the provider list', () => {
        mockProviders.data = [
            {
                name: 'mid',
                displayName: 'Mid Router',
                iconUrl: 'https://x/mid.png',
            },
        ] as SwapProviderItem[]
        const quote = makeQuote({
            provider: 'mid',
            providerDisplayName: 'Mid (quote)',
            amountOut: new Decimal('200'),
        })

        const { result } = renderContent([BEST, quote])

        expect(result.current.rows[0]).toMatchObject({
            displayName: 'Mid (quote)',
            iconUrl: 'https://x/mid.png',
        })
    })

    it('names the row from the provider list when the quote has no display name', () => {
        mockProviders.data = [
            {
                name: 'mid',
                displayName: 'Mid Router',
                iconUrl: 'https://x/mid.png',
            },
        ] as SwapProviderItem[]
        const quote = makeQuote({
            provider: 'mid',
            amountOut: new Decimal('200'),
        })

        const { result } = renderContent([BEST, quote])

        expect(result.current.rows[0].displayName).toBe('Mid Router')
    })

    it('falls back to the raw provider name when the provider is unlisted', () => {
        const quote = makeQuote({
            provider: 'mid',
            amountOut: new Decimal('200'),
        })

        const { result } = renderContent([BEST, quote])

        expect(result.current.rows[0]).toMatchObject({
            displayName: 'mid',
            iconUrl: undefined,
        })
    })

    it('shows placeholders for a quote with no provider or amount', () => {
        const { result } = renderContent([BEST, makeQuote({})])

        expect(result.current.rows[0]).toMatchObject({
            displayName: '-',
            amountDisplay: '-',
            fiatValue: null,
        })
    })

    it('formats the amount and converts its fiat value to the preferred currency', () => {
        const quote = makeQuote({
            provider: 'mid',
            amountOut: new Decimal('200'),
            amountOutUsdValue: '12.5',
        })

        const { result } = renderContent([BEST, quote])

        expect(result.current.rows[0].amountDisplay).toBe('200 USDC')
        expect(result.current.rows[0].fiatValue?.toString()).toBe('25')
    })

    it('omits the fiat value while the exchange rate is unresolved', () => {
        vi.mocked(useCurrency).mockReturnValue({
            preferredCurrency: 'USD',
            usdToPreferred: () => null,
        } as unknown as ReturnType<typeof useCurrency>)
        const quote = makeQuote({
            provider: 'mid',
            amountOut: new Decimal('200'),
            amountOutUsdValue: '12.5',
        })

        const { result } = renderContent([BEST, quote])

        expect(result.current.rows[0].fiatValue).toBeNull()
    })
})
