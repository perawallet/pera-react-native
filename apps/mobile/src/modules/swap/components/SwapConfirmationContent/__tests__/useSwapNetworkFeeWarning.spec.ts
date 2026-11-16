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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { SwapQuote, SwapSourceCost } from '@perawallet/wallet-core-swaps'
import { useSwapNetworkFeeWarning } from '../useSwapNetworkFeeWarning'

const { mockT, mockUseAssetPricesQuery } = vi.hoisted(() => ({
    mockT: vi.fn((key: string) => key),
    mockUseAssetPricesQuery: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: mockT, currentLanguage: 'en' }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    nativeAssetFor: () => ({ assetId: 'native' }),
    useAssetPricesQuery: mockUseAssetPricesQuery,
}))

vi.mock('../../../hooks/useSwapFiatText', () => ({
    useSwapFiatText: () => (usd: Decimal, rounding: Decimal.Rounding) =>
        `USD ${usd.toDecimalPlaces(2, rounding).toFixed(2)}`,
}))

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

// 10^15 wei = 0.001 ETH; at $3,000 that is a $3 fee.
const SOURCE_COST = {
    networkFee: new Decimal(10).pow(15),
    nativeDecimals: 18,
} as unknown as SwapSourceCost

const quoteWorth = (
    amountInUsdValue: string | null,
    networkFeeUsd: string | null = null,
) =>
    ({
        amountInUsdValue,
        fees: networkFeeUsd
            ? [
                  {
                      kind: 'network',
                      asset: { ...SCOPE, assetId: 'native' },
                      amount: new Decimal(1),
                      usdValue: networkFeeUsd,
                  },
              ]
            : [],
    }) as unknown as SwapQuote

const render = ({
    quote,
    sourceCost = SOURCE_COST,
    isSourceCostLoading = false,
}: {
    quote: SwapQuote
    sourceCost?: SwapSourceCost | null
    isSourceCostLoading?: boolean
}) =>
    renderHook(() =>
        useSwapNetworkFeeWarning({
            quote,
            scope: SCOPE,
            sourceCost,
            isSourceCostLoading,
        }),
    ).result.current

const pricedAt = (usdPrice: string) =>
    mockUseAssetPricesQuery.mockReturnValue({
        data: new Map([['native', { usdPrice: new Decimal(usdPrice) }]]),
    })

describe('useSwapNetworkFeeWarning', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        pricedAt('3000')
    })

    it("warns with the estimate's fiat value and its share of the swap", () => {
        const message = render({ quote: quoteWorth('10') })

        expect(message).toBe('swap.quote.high_network_fee_warning')
        expect(mockT).toHaveBeenCalledWith(
            'swap.quote.high_network_fee_warning',
            { fee: 'USD 3.00', percent: '30' },
        )
    })

    it('stays quiet at exactly 10% of the swap', () => {
        expect(render({ quote: quoteWorth('30') })).toBeNull()
    })

    it('rounds a share just over 10% up, never down to the threshold', () => {
        render({ quote: quoteWorth('29.9') })

        expect(mockT).toHaveBeenCalledWith(
            'swap.quote.high_network_fee_warning',
            expect.objectContaining({ percent: '11' }),
        )
    })

    it("values the quote's fee when the native coin has no price", () => {
        mockUseAssetPricesQuery.mockReturnValue({ data: new Map() })

        render({ quote: quoteWorth('1', '0.31') })

        expect(mockT).toHaveBeenCalledWith(
            'swap.quote.high_network_fee_warning',
            { fee: 'USD 0.31', percent: '31' },
        )
    })

    it('waits for the source estimate, like the fee row', () => {
        expect(
            render({
                quote: quoteWorth('1', '0.31'),
                isSourceCostLoading: true,
            }),
        ).toBeNull()
    })

    it('says nothing when the swap has no USD value', () => {
        expect(render({ quote: quoteWorth(null) })).toBeNull()
    })
})
