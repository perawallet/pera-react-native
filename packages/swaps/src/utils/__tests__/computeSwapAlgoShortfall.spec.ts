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
import { computeSwapAlgoShortfall } from '../computeSwapAlgoShortfall'

import type { SwapQuote } from '../../models'

const ALGO = { assetId: '0' }
const USDC = { assetId: '31566704' }
const OTHER = { assetId: '999' }

const d = (value: number | string) => new Decimal(value)

type QuoteOverrides = Partial<SwapQuote> & {
    assetIn?: { assetId: string }
    assetOut?: { assetId: string }
}

// Amounts are microAlgos / base units throughout, mirroring the backend's
// prepare-time validation which this util replicates.
const makeQuote = (overrides: QuoteOverrides = {}): SwapQuote =>
    ({
        assetIn: ALGO,
        assetOut: USDC,
        amountIn: d(200_000),
        amountInWithSlippage: d(200_000),
        amountOut: d(17_000),
        amountOutWithSlippage: d(16_800),
        transactionFees: d(4_000),
        peraFeeAmount: d(1_000),
        ...overrides,
    }) as SwapQuote

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

    it('does not subtract the input amount for an ASA-in swap', () => {
        // Only fees + pera fee leave the ALGO balance: 206_000 - 4_000 - 1_000
        // = 201_000 >= 200_000.
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote({
                assetIn: USDC,
                assetOut: OTHER,
                amountIn: d(1_000_000),
                amountInWithSlippage: d(1_000_000),
            }),
            algoBalance: d(206_000),
            minBalance: d(200_000),
        })

        expect(shortfall).toBeNull()
    })

    it('flags fee coverage for an ASA-in swap that cannot pay its fees', () => {
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote({
                assetIn: USDC,
                assetOut: OTHER,
            }),
            algoBalance: d(203_000),
            minBalance: d(200_000),
        })

        // 203_000 - 4_000 - 1_000 = 198_000; 2_000 short of the MBR.
        expect(shortfall?.toString()).toBe('2000')
    })

    it('ignores the ALGO output credit for the post-swap check, like the backend', () => {
        // The backend validates the post-swap balance BEFORE crediting the
        // ALGO output (algod evaluates group slots sequentially, so the
        // balance can dip mid-group). An ASA-in / ALGO-out swap whose network
        // fees breach the MBR must fail even though the output would cover
        // it: 203_000 - 4_000 = 199_000, 1_000 below the MBR. The pera-fee
        // check (which does credit the output) passes and must not mask it.
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote({
                assetIn: USDC,
                assetOut: ALGO,
                amountOut: d(1_000_000),
                amountOutWithSlippage: d(990_000),
            }),
            algoBalance: d(203_000),
            minBalance: d(200_000),
        })

        expect(shortfall?.toString()).toBe('1000')
    })

    it('credits the ALGO output before checking the pera fee, like the backend', () => {
        // Post-swap: 204_000 - 4_000 = 200_000 (passes). Pera fee check runs
        // after crediting the slippage-adjusted output: 200_000 + 990_000 -
        // 1_000 stays above the MBR.
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote({
                assetIn: USDC,
                assetOut: ALGO,
                amountOut: d(1_000_000),
                amountOutWithSlippage: d(990_000),
            }),
            algoBalance: d(204_000),
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
                peraFeeAsset: USDC,
            } as QuoteOverrides),
            algoBalance: d(204_000),
            minBalance: d(200_000),
        })

        expect(shortfall).toBeNull()
    })

    it('treats a pera fee asset of ALGO the same as no fee asset', () => {
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote({
                assetIn: USDC,
                assetOut: OTHER,
                peraFeeAsset: ALGO,
            } as QuoteOverrides),
            algoBalance: d(204_000),
            minBalance: d(200_000),
        })

        // 204_000 - 4_000 - 1_000 = 199_000; 1_000 short.
        expect(shortfall?.toString()).toBe('1000')
    })

    it('raises the requirement by the opt-in MBR when provided', () => {
        // Covered against the current MBR, but not once the group's opt-in
        // raises it by 100_000.
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote(),
            algoBalance: d(500_000),
            minBalance: d(200_000),
            optInMbr: d(100_000),
        })

        expect(shortfall?.toString()).toBe('5000')
    })

    it('prefers the slippage-adjusted input amount over the raw one', () => {
        // Fixed-output swap: the input can grow with slippage, and the backend
        // validates against the slippage-adjusted figure.
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote({
                amountIn: d(200_000),
                amountInWithSlippage: d(210_000),
            }),
            algoBalance: d(405_000),
            minBalance: d(200_000),
        })

        expect(shortfall?.toString()).toBe('10000')
    })

    it('treats missing fee and amount fields as zero', () => {
        const shortfall = computeSwapAlgoShortfall({
            quote: makeQuote({
                amountIn: undefined,
                amountInWithSlippage: undefined,
                amountOut: undefined,
                amountOutWithSlippage: undefined,
                transactionFees: undefined,
                peraFeeAmount: undefined,
            }),
            algoBalance: d(100_000),
            minBalance: d(200_000),
        })

        // Nothing leaves the account, but it is already below its MBR — the
        // backend would still reject, so report the standing deficit.
        expect(shortfall?.toString()).toBe('100000')
    })
})
