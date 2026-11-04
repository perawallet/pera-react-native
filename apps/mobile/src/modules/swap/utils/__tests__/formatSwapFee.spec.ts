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
// @vitest-environment node

import { describe, it, expect, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import { formatSwapFee, formatSwapSlippage } from '../formatSwapFee'

vi.mock('@perawallet/wallet-core-assets', () => ({
    formatAssetAmount: (
        amount: { toString: () => string },
        asset: { unitName: string },
    ) => `${amount.toString()} ${asset.unitName}`,
}))

const refOf = (assetId: string) => ({
    chainId: 'algorand' as const,
    networkId: 'mainnet' as const,
    assetId,
})

const quoteWith = (
    fees: SwapQuote['fees'],
    slippage: string | null = null,
): SwapQuote =>
    ({
        assetIn: { assetId: '0', ref: refOf('0'), unitName: 'ALGO' },
        assetOut: {
            assetId: '31566704',
            ref: refOf('31566704'),
            unitName: 'USDC',
        },
        request: { slippage },
        fees,
    }) as unknown as SwapQuote

const feeIn = (assetId: string, kind: 'pera' | 'network' = 'pera') => ({
    kind,
    asset: refOf(assetId),
    amount: new Decimal('1500'),
    usdValue: null,
})

describe('formatSwapFee', () => {
    it('formats the fee in the leg asset it is charged in', () => {
        expect(formatSwapFee(quoteWith([feeIn('31566704')]), 'pera')).toBe(
            '1500 USDC',
        )
    })

    it('picks the fee of the asked kind', () => {
        const quote = quoteWith([feeIn('31566704'), feeIn('0', 'network')])

        expect(formatSwapFee(quote, 'network')).toBe('1500 ALGO')
    })

    it('is null when the quote carries no such fee', () => {
        expect(formatSwapFee(quoteWith([]), 'pera')).toBeNull()
    })

    it('is null when the fee is in an asset neither leg describes', () => {
        expect(formatSwapFee(quoteWith([feeIn('99')]), 'pera')).toBeNull()
    })
})

describe('formatSwapSlippage', () => {
    it('shows the requested percent', () => {
        expect(formatSwapSlippage(quoteWith([], '0.5'))).toBe('0.5%')
    })

    it("shows a dash when the router's default applies", () => {
        expect(formatSwapSlippage(quoteWith([]))).toBe('-')
    })
})
