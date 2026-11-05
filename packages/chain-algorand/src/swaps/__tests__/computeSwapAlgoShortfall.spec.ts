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

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import type { SwapFee, SwapQuote } from '@perawallet/wallet-core-swaps'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { computeSwapAlgoShortfall } from '../computeSwapAlgoShortfall'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const
const ALGO = '0'
const USDC = '31566704'
const OTHER = '999'

const d = (value: number | string) => new Decimal(value)

const fee = (
    kind: SwapFee['kind'],
    assetId: string,
    amount: number,
): SwapFee => ({
    kind,
    asset: { ...SCOPE, assetId },
    amount: d(amount),
    usdValue: null,
})

type QuoteShape = {
    assetIn?: string
    assetOut?: string
    sourceAmount?: number
    amountIn?: number
    amountOut?: number
    minimumAmountOut?: Nullable<number>
    networkFee?: Nullable<number>
    peraFee?: Nullable<{ assetId: string; amount: number }>
}

// Amounts are microAlgos / base units throughout, mirroring the backend's
// order-time validation which this util replicates.
const makeQuote = ({
    assetIn = ALGO,
    assetOut = USDC,
    sourceAmount = 200_000,
    amountIn = sourceAmount,
    amountOut = 17_000,
    minimumAmountOut = 16_800,
    networkFee = 4_000,
    peraFee = { assetId: ALGO, amount: 1_000 },
}: QuoteShape = {}): SwapQuote =>
    ({
        request: {
            sourceAsset: { ...SCOPE, assetId: assetIn },
            destinationAsset: { ...SCOPE, assetId: assetOut },
            sourceAmount: d(sourceAmount),
            sourceAddress: 'SENDER',
            destinationAddress: 'SENDER',
            slippage: null,
        },
        assetIn: { assetId: assetIn },
        assetOut: { assetId: assetOut },
        amountIn: d(amountIn),
        amountOut: d(amountOut),
        minimumAmountOut:
            minimumAmountOut === null ? null : d(minimumAmountOut),
        fees: [
            ...(networkFee === null ? [] : [fee('network', ALGO, networkFee)]),
            ...(peraFee === null
                ? []
                : [fee('pera', peraFee.assetId, peraFee.amount)]),
        ],
    }) as unknown as SwapQuote

describe('computeSwapAlgoShortfall', () => {
    it('returns null when the balance covers amount, fees, pera fee and min balance', () => {
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote(),
            algoBalance: d(500_000),
            minBalance: d(200_000),
        })

        expect(shortfall).toBeNull()
    })

    it('names the exact shortfall for an ALGO-in swap that would breach the min balance', () => {
        // 400_000 - 200_000 (in) - 4_000 (fees) - 1_000 (pera fee) = 195_000,
        // which is 5_000 below the 200_000 MBR.
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote(),
            algoBalance: d(400_000),
            minBalance: d(200_000),
        })

        expect(shortfall?.toString()).toBe('5000')
    })

    it('returns null at the exact boundary', () => {
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote(),
            algoBalance: d(405_000),
            minBalance: d(200_000),
        })

        expect(shortfall).toBeNull()
    })

    it('reads the input from the request, not the router figure', () => {
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote({ amountIn: 900_000 }),
            algoBalance: d(405_000),
            minBalance: d(200_000),
        })

        expect(shortfall).toBeNull()
    })

    it('does not subtract the input amount for an ASA-in swap', () => {
        // Only fees + pera fee leave the ALGO balance: 206_000 - 4_000 - 1_000
        // = 201_000 >= 200_000.
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote({
                assetIn: USDC,
                assetOut: OTHER,
                sourceAmount: 1_000_000,
            }),
            algoBalance: d(206_000),
            minBalance: d(200_000),
        })

        expect(shortfall).toBeNull()
    })

    it('flags fee coverage for an ASA-in swap that cannot pay its fees', () => {
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote({ assetIn: USDC, assetOut: OTHER }),
            algoBalance: d(203_000),
            minBalance: d(200_000),
        })

        // 203_000 - 4_000 - 1_000 = 198_000; 2_000 short of the MBR.
        expect(shortfall?.toString()).toBe('2000')
    })

    it('ignores the ALGO output credit for the post-swap check, like the backend', () => {
        // The backend validates the post-swap balance BEFORE crediting the
        // ALGO output (algod evaluates group slots sequentially, so the
        // balance can dip mid-group): 203_000 - 4_000 = 199_000, 1_000 below
        // the MBR. The pera-fee check (which does credit the output) passes and
        // must not mask it.
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote({
                assetIn: USDC,
                assetOut: ALGO,
                amountOut: 1_000_000,
                minimumAmountOut: 990_000,
            }),
            algoBalance: d(203_000),
            minBalance: d(200_000),
        })

        expect(shortfall?.toString()).toBe('1000')
    })

    it('credits the minimum ALGO output before checking the pera fee, like the backend', () => {
        // Post-swap: 204_000 - 4_000 = 200_000 (passes). The pera fee check
        // credits the minimum output: 200_000 + 990_000 - 1_000.
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote({
                assetIn: USDC,
                assetOut: ALGO,
                amountOut: 1_000_000,
                minimumAmountOut: 990_000,
            }),
            algoBalance: d(204_000),
            minBalance: d(200_000),
        })

        expect(shortfall).toBeNull()
    })

    it('credits the expected output when the route sets no minimum', () => {
        // 1_000 short on the pera fee alone, covered by the expected output.
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote({
                assetIn: USDC,
                assetOut: ALGO,
                amountOut: 5_000,
                minimumAmountOut: null,
                networkFee: null,
                peraFee: { assetId: ALGO, amount: 5_000 },
            }),
            algoBalance: d(200_000),
            minBalance: d(200_000),
        })

        expect(shortfall).toBeNull()
    })

    it('does not subtract a pera fee charged in a non-ALGO asset', () => {
        // ASA-in, so only network fees leave the ALGO balance: 204_000 -
        // 4_000 = 200_000 exactly; the 1_000 pera fee is owed in USDC.
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote({
                assetIn: USDC,
                assetOut: OTHER,
                peraFee: { assetId: USDC, amount: 1_000 },
            }),
            algoBalance: d(204_000),
            minBalance: d(200_000),
        })

        expect(shortfall).toBeNull()
    })

    it('raises the requirement by the opt-in MBR when provided', () => {
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote(),
            algoBalance: d(500_000),
            minBalance: d(200_000),
            optInMbr: d(100_000),
        })

        expect(shortfall?.toString()).toBe('5000')
    })

    it('treats missing fees as zero', () => {
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote({
                assetIn: USDC,
                assetOut: OTHER,
                networkFee: null,
                peraFee: null,
            }),
            algoBalance: d(100_000),
            minBalance: d(200_000),
        })

        // Nothing leaves the account, but it is already below its MBR — the
        // backend would still reject, so report the standing deficit.
        expect(shortfall?.toString()).toBe('100000')
    })
})
