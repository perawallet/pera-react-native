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

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import {
    validateSwapGroupAgainstQuote,
    SwapQuoteMismatchError,
} from '../validateSwapGroupAgainstQuote'

const SWAPPER = 'SWAPPER_ADDRESS'
const POOL = 'POOL_ADDRESS'

// ASA 31566704 (USDC) → ASA 999 swap, fixed-input.
const baseQuote = {
    quoteIdStr: 'q1',
    swapperAddress: SWAPPER,
    assetIn: { assetId: '31566704', decimals: 6 },
    assetOut: { assetId: '999', decimals: 6 },
    amountIn: new Decimal(5_000_000),
    amountInWithSlippage: new Decimal(5_000_000),
    amountOut: new Decimal(4_000_000),
    amountOutWithSlippage: new Decimal(3_900_000),
} as unknown as SwapQuote

const axfer = (
    overrides: Partial<{
        sender: string
        assetId: bigint
        amount: bigint
        receiver: string
        closeTo: string
    }> = {},
): PeraDisplayableTransaction =>
    ({
        sender: overrides.sender ?? SWAPPER,
        assetTransferTransaction: {
            assetId: overrides.assetId ?? 31_566_704n,
            amount: overrides.amount ?? 5_000_000n,
            receiver: overrides.receiver ?? POOL,
            closeTo: overrides.closeTo,
        },
    }) as unknown as PeraDisplayableTransaction

const payment = (
    overrides: Partial<{
        sender: string
        amount: bigint
        receiver: string
        closeRemainderTo: string
    }> = {},
): PeraDisplayableTransaction =>
    ({
        sender: overrides.sender ?? SWAPPER,
        paymentTransaction: {
            amount: overrides.amount ?? 0n,
            receiver: overrides.receiver ?? POOL,
            closeRemainderTo: overrides.closeRemainderTo,
        },
    }) as unknown as PeraDisplayableTransaction

describe('validateSwapGroupAgainstQuote', () => {
    it('passes a swap that spends exactly the quoted input', () => {
        expect(() =>
            validateSwapGroupAgainstQuote([axfer()], baseQuote),
        ).not.toThrow()
    })

    it('passes when the input is sent across multiple txns within the bound', () => {
        expect(() =>
            validateSwapGroupAgainstQuote(
                [axfer({ amount: 3_000_000n }), axfer({ amount: 2_000_000n })],
                baseQuote,
            ),
        ).not.toThrow()
    })

    it('ignores transactions not sent by the swapper', () => {
        // A pool/clawback transfer of another asset, not signed by the swapper.
        expect(() =>
            validateSwapGroupAgainstQuote(
                [axfer(), axfer({ sender: POOL, assetId: 7n })],
                baseQuote,
            ),
        ).not.toThrow()
    })

    it('rejects an outflow of an unexpected asset', () => {
        expect(() =>
            validateSwapGroupAgainstQuote(
                [axfer(), axfer({ assetId: 7n, amount: 1n })],
                baseQuote,
            ),
        ).toThrow(SwapQuoteMismatchError)
    })

    it('rejects spending more of the input asset than quoted', () => {
        expect(() =>
            validateSwapGroupAgainstQuote(
                [axfer({ amount: 6_000_000n })],
                baseQuote,
            ),
        ).toThrow(SwapQuoteMismatchError)
    })

    it('rejects a close-out of an asset', () => {
        expect(() =>
            validateSwapGroupAgainstQuote(
                [axfer({ closeTo: POOL })],
                baseQuote,
            ),
        ).toThrow(SwapQuoteMismatchError)
    })

    it('rejects a close-remainder on a payment', () => {
        expect(() =>
            validateSwapGroupAgainstQuote(
                [axfer(), payment({ closeRemainderTo: POOL })],
                baseQuote,
            ),
        ).toThrow(SwapQuoteMismatchError)
    })

    it('rejects a large ALGO payment beyond the network-fee allowance', () => {
        expect(() =>
            validateSwapGroupAgainstQuote(
                [axfer(), payment({ amount: 1_000_000n })],
                baseQuote,
            ),
        ).toThrow(SwapQuoteMismatchError)
    })

    it('allows a small ALGO payment within the network-fee allowance', () => {
        expect(() =>
            validateSwapGroupAgainstQuote(
                [axfer(), payment({ amount: 1000n })],
                baseQuote,
            ),
        ).not.toThrow()
    })

    it('allows the Pera fee in its own asset up to the quoted amount', () => {
        const quote = {
            ...baseQuote,
            peraFeeAsset: { assetId: '111', decimals: 6 },
            peraFeeAmount: new Decimal(10_000),
        } as unknown as SwapQuote

        expect(() =>
            validateSwapGroupAgainstQuote(
                [axfer(), axfer({ assetId: 111n, amount: 10_000n })],
                quote,
            ),
        ).not.toThrow()
    })

    it('rejects a quote with no swapper address', () => {
        const quote = {
            ...baseQuote,
            swapperAddress: undefined,
        } as unknown as SwapQuote

        expect(() => validateSwapGroupAgainstQuote([axfer()], quote)).toThrow(
            SwapQuoteMismatchError,
        )
    })
})
