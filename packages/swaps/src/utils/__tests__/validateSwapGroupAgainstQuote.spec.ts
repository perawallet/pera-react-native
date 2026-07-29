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

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import type { SwapQuote } from '../../models'
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
        rekeyTo: string
    }> = {},
): PeraDisplayableTransaction =>
    ({
        sender: overrides.sender ?? SWAPPER,
        rekeyTo: overrides.rekeyTo,
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
        rekeyTo: string
    }> = {},
): PeraDisplayableTransaction =>
    ({
        sender: overrides.sender ?? SWAPPER,
        rekeyTo: overrides.rekeyTo,
        paymentTransaction: {
            amount: overrides.amount ?? 0n,
            receiver: overrides.receiver ?? POOL,
            closeRemainderTo: overrides.closeRemainderTo,
        },
    }) as unknown as PeraDisplayableTransaction

const withPeraFeeAsset = (assetId: string, amount: number): SwapQuote =>
    ({
        ...baseQuote,
        peraFeeAsset: { assetId, decimals: 6 },
        peraFeeAmount: new Decimal(amount),
    }) as unknown as SwapQuote

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

    it('rejects a signable transaction from a non-swapper sender (Variant B)', () => {
        // Every entry is a slot the wallet will sign; one whose sender is not
        // the swapper is a second account the user never reviewed, so the
        // wallet must fail closed rather than sign it. (PERA-4709)
        expect(() =>
            validateSwapGroupAgainstQuote(
                [axfer(), axfer({ sender: 'ACCOUNT_B', assetId: 7n })],
                baseQuote,
            ),
        ).toThrow(SwapQuoteMismatchError)
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

    it('rejects a transaction that rekeys the swapper account', () => {
        expect(() =>
            validateSwapGroupAgainstQuote(
                [axfer({ rekeyTo: POOL })],
                baseQuote,
            ),
        ).toThrow(SwapQuoteMismatchError)
    })

    it('rejects a drain when the quote swapper does not match the group (Variant A no-op guard)', () => {
        // A wrong swapper used to disable the validator entirely: `outflow` is
        // only populated for matching senders, so a mismatch left it empty and
        // the spend-ceiling loop ran zero times — a full drain passed. With
        // fail-closed the mismatched sender throws first. (PERA-4709)
        const wrongSwapperQuote = {
            ...baseQuote,
            swapperAddress: 'WRONG_SWAPPER_ADDRESS',
        } as unknown as SwapQuote
        expect(() =>
            validateSwapGroupAgainstQuote(
                [axfer({ amount: 999_999_999n })],
                wrongSwapperQuote,
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
        expect(() =>
            validateSwapGroupAgainstQuote(
                [axfer(), axfer({ assetId: 111n, amount: 10_000n })],
                withPeraFeeAsset('111', 10_000),
            ),
        ).not.toThrow()
    })

    it('allows input + Pera fee in the same asset up to their combined bound', () => {
        // Pera fee charged in the input asset: total outflow = input + fee, and
        // the bound is the sum of both (not just one of them).
        expect(() =>
            validateSwapGroupAgainstQuote(
                [axfer({ amount: 5_000_000n }), axfer({ amount: 100_000n })],
                withPeraFeeAsset('31566704', 100_000),
            ),
        ).not.toThrow()
    })

    it('rejects exceeding the combined input + Pera fee bound for a shared asset', () => {
        expect(() =>
            validateSwapGroupAgainstQuote(
                [axfer({ amount: 5_100_001n })],
                withPeraFeeAsset('31566704', 100_000),
            ),
        ).toThrow(SwapQuoteMismatchError)
    })

    it('coerces a numeric (non-bigint) amount and bounds it like a bigint', () => {
        // Some provider payloads surface amounts as JS numbers rather than
        // bigints; they must be coerced and bounded identically.
        const numericAxfer = {
            sender: SWAPPER,
            assetTransferTransaction: {
                assetId: 31_566_704n,
                amount: 6_000_000, // number, over the 5_000_000 input bound
                receiver: POOL,
            },
        } as unknown as PeraDisplayableTransaction

        expect(() =>
            validateSwapGroupAgainstQuote([numericAxfer], baseQuote),
        ).toThrow(SwapQuoteMismatchError)
    })

    it('truncates a fractional numeric amount within the bound', () => {
        const numericAxfer = {
            sender: SWAPPER,
            assetTransferTransaction: {
                assetId: 31_566_704n,
                amount: 4_999_999.9, // trunc → 4_999_999, within bound
                receiver: POOL,
            },
        } as unknown as PeraDisplayableTransaction

        expect(() =>
            validateSwapGroupAgainstQuote([numericAxfer], baseQuote),
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
