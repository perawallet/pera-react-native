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
import { peraFeeInSourceAsset, swapFeeOf } from '../swapFees'

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
