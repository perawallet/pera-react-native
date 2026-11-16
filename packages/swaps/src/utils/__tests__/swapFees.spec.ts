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

import { describe, expect, test } from 'vitest'
import { Decimal } from 'decimal.js'
import type { SwapFee, SwapQuote } from '../../models'
import type { SwapSourceCost } from '../../chain-adapter'
import {
    peraFeeInSourceAsset,
    swapFeeOf,
    swapNetworkFeeSharePercent,
    swapNetworkFeeUsd,
} from '../swapFees'

const SOURCE = { chainId: 'fake-a', networkId: 'main', assetId: 'native' }

const quoteWith = (fees: Partial<SwapFee>[]): SwapQuote =>
    ({
        request: { sourceAsset: SOURCE },
        fees,
    }) as unknown as SwapQuote

describe('swapFeeOf', () => {
    const ALGO_SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const
    const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
    const quote = quoteWith([
        {
            kind: 'network',
            asset: { ...ETH_SCOPE, assetId: 'native' },
            amount: new Decimal(1),
        },
        {
            kind: 'network',
            asset: { ...ALGO_SCOPE, assetId: '0' },
            amount: new Decimal(2),
        },
    ])

    test('returns the first fee of a kind', () => {
        expect(swapFeeOf(quote, 'network')?.amount).toEqual(new Decimal(1))
    })

    test('with a scope, returns the first fee charged there', () => {
        expect(swapFeeOf(quote, 'network', ALGO_SCOPE)?.amount).toEqual(
            new Decimal(2),
        )
    })
})

describe('peraFeeInSourceAsset', () => {
    test('returns the Pera fee charged in the source asset', () => {
        const quote = quoteWith([
            { kind: 'network', asset: SOURCE, amount: new Decimal(1000) },
            { kind: 'pera', asset: SOURCE, amount: new Decimal(3000) },
        ])

        expect(peraFeeInSourceAsset(quote)).toEqual(new Decimal(3000))
    })

    test('is zero when the Pera fee is charged in another asset', () => {
        const quote = quoteWith([
            {
                kind: 'pera',
                asset: { ...SOURCE, assetId: '31566704' },
                amount: new Decimal(3000),
            },
        ])

        expect(peraFeeInSourceAsset(quote)).toEqual(new Decimal(0))
    })

    test('is zero when the quote carries no Pera fee', () => {
        expect(peraFeeInSourceAsset(quoteWith([]))).toEqual(new Decimal(0))
    })
})

describe('swapNetworkFeeUsd', () => {
    const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
    // 10^15 base units of an 18-decimal coin = 0.001; the ceiling is twice that.
    const SOURCE_COST = {
        networkFee: new Decimal(2).mul(new Decimal(10).pow(15)),
        expectedNetworkFee: new Decimal(10).pow(15),
        nativeDecimals: 18,
    } as unknown as SwapSourceCost
    const quotedAt = (usdValue: string | null) =>
        quoteWith([
            {
                kind: 'network',
                asset: { ...SCOPE, assetId: 'native' },
                amount: new Decimal(1),
                usdValue,
            },
        ])

    test("prefers the router's own fee when the quote carries one", () => {
        expect(
            swapNetworkFeeUsd({
                quote: quotedAt('0.31'),
                scope: SCOPE,
                sourceCost: SOURCE_COST,
                nativeUsdPrice: new Decimal(3000),
            }),
        ).toEqual(new Decimal('0.31'))
    })

    test('values the expected estimate, not the ceiling, without one', () => {
        expect(
            swapNetworkFeeUsd({
                quote: quotedAt(null),
                scope: SCOPE,
                sourceCost: SOURCE_COST,
                nativeUsdPrice: new Decimal(3000),
            }),
        ).toEqual(new Decimal(3))
    })

    test.each([
        ['no estimate', null, new Decimal(3000)],
        ['no native price', SOURCE_COST, undefined],
        ['a zero native price', SOURCE_COST, new Decimal(0)],
    ])('is null without a router fee and with %s', (_, sourceCost, price) => {
        expect(
            swapNetworkFeeUsd({
                quote: quotedAt(null),
                scope: SCOPE,
                sourceCost,
                nativeUsdPrice: price,
            }),
        ).toBeNull()
    })
})

describe('swapNetworkFeeSharePercent', () => {
    const quoteWorth = (amountInUsdValue: string | null) =>
        ({ amountInUsdValue }) as unknown as SwapQuote

    test("gives the fee as a percent of the swap's value", () => {
        expect(
            swapNetworkFeeSharePercent(quoteWorth('4'), new Decimal(1)),
        ).toEqual(new Decimal(25))
    })

    test.each([null, '0'])('is null for a swap worth %s', value => {
        expect(
            swapNetworkFeeSharePercent(quoteWorth(value), new Decimal(1)),
        ).toBeNull()
    })
})
