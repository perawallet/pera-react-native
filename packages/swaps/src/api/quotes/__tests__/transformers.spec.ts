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

import { Decimal } from 'decimal.js'
import { describe, expect, test } from 'vitest'
import { registerSecondFakeSwapAdapter } from '../../../__tests__/fakeSwapAdapter'
import { fakeRouterAssetId } from '../../../__tests__/fakeRouterChains'
import { SwapQuoteMismatchError } from '../../../errors'
import type { SwapQuoteRequest } from '../../../models'
import { swapAssetRefOf } from '../../router-ids'
import { transformSwapQuote } from '../transformers'
import {
    routerAsset,
    routerOffer,
    SCOPE_A,
    SCOPE_B,
} from '../../__tests__/routerFixtures'

const request: SwapQuoteRequest = {
    sourceAsset: { ...SCOPE_A, assetId: 'native' },
    destinationAsset: { ...SCOPE_A, assetId: '31566704' },
    sourceAmount: new Decimal('5000000'),
    sourceAddress: 'SENDER',
    destinationAddress: 'SENDER',
    slippage: '0.5',
}

describe('transformSwapQuote', () => {
    test('carries each leg on its own chain for a cross-chain offer', () => {
        registerSecondFakeSwapAdapter()

        const quote = transformSwapQuote(
            routerOffer({ destination_asset: routerAsset(SCOPE_B, 'usdc') }),
            request,
            swapAssetRefOf,
        )

        expect(quote.assetIn.ref).toEqual({ ...SCOPE_A, assetId: 'native' })
        expect(quote.assetOut.ref).toEqual({ ...SCOPE_B, assetId: 'usdc' })
        expect(quote.assetOut.assetId).toBe('usdc')
        expect(quote.routeKind).toBe('cross-chain')
    })

    test('marks an offer on one chain and network single-chain', () => {
        const quote = transformSwapQuote(routerOffer(), request, swapAssetRefOf)

        expect(quote.routeKind).toBe('single-chain')
    })

    test('maps fees to base-unit amounts and drops ones it cannot read', () => {
        const quote = transformSwapQuote(
            routerOffer({
                fees: [
                    {
                        kind: 'pera',
                        asset_id: fakeRouterAssetId(SCOPE_A, 'native'),
                        amount: '1500',
                        usd_value: '0.01',
                    },
                    {
                        kind: 'network',
                        asset_id: 'nope:1/token:x',
                        amount: '1',
                        usd_value: null,
                    },
                ],
            }),
            request,
            swapAssetRefOf,
        )

        expect(quote.fees).toEqual([
            {
                kind: 'pera',
                asset: { ...SCOPE_A, assetId: 'native' },
                amount: new Decimal(1500),
                usdValue: '0.01',
            },
        ])
    })

    test('passes a missing minimum and USD values through as null', () => {
        const quote = transformSwapQuote(
            routerOffer({
                destination_amount_minimum: null,
                source_amount_usd_value: null,
                destination_amount_usd_value: null,
            }),
            request,
            swapAssetRefOf,
        )

        expect(quote.minimumAmountOut).toBeNull()
        expect(quote.amountInUsdValue).toBeNull()
        expect(quote.amountOutUsdValue).toBeNull()
    })

    test('keeps the request it answers and the router figures apart', () => {
        const quote = transformSwapQuote(
            routerOffer({
                destination_amount_expected: '1200000',
                expires_at: '2026-10-01T10:00:00Z',
                extras: { price_impact: '0.42' },
            }),
            request,
            swapAssetRefOf,
        )

        expect(quote.request).toBe(request)
        expect(quote.quoteId).toBe('quote-1')
        expect(quote.amountIn).toEqual(new Decimal('5000000'))
        expect(quote.amountOut).toEqual(new Decimal('1200000'))
        expect(quote.priceImpact).toEqual(new Decimal('0.42'))
        expect(quote.expiresAt).toBe(Date.parse('2026-10-01T10:00:00Z'))
    })

    test('refuses an offer whose leg no swap chain can read', () => {
        expect(() =>
            transformSwapQuote(
                routerOffer({
                    destination_asset: routerAsset(SCOPE_B, 'usdc'),
                }),
                request,
                swapAssetRefOf,
            ),
        ).toThrow(SwapQuoteMismatchError)
    })
})
