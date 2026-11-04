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
import {
    SwapQuoteMismatchError,
    type SwapFee,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'
import { validateSwapGroupAgainstQuote } from '../validateSwapGroupAgainstQuote'
import type { PeraDisplayableTransaction } from '../../blockchain/models/algosdk-shapes'

const SWAPPER = 'SWAPPER_ADDRESS'
const POOL = 'POOL_ADDRESS'

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

type QuoteShape = {
    sourceAddress?: string
    sourceAssetId?: string
    sourceAmount?: number
    amountIn?: number
    fees?: SwapFee[]
    sourceChainId?: string
}

// ASA 31566704 (USDC) → ASA 999 swap, fixed-input.
const quoteWith = ({
    sourceAddress = SWAPPER,
    sourceAssetId = '31566704',
    sourceAmount = 5_000_000,
    amountIn = sourceAmount,
    fees = [],
    sourceChainId = 'algorand',
}: QuoteShape = {}): SwapQuote =>
    ({
        quoteId: 'q1',
        request: {
            sourceAsset: {
                chainId: sourceChainId,
                networkId: 'mainnet',
                assetId: sourceAssetId,
            },
            destinationAsset: { ...SCOPE, assetId: '999' },
            sourceAmount: new Decimal(sourceAmount),
            sourceAddress,
            destinationAddress: sourceAddress,
            slippage: '0.5',
        },
        assetIn: { assetId: sourceAssetId, decimals: 6 },
        assetOut: { assetId: '999', decimals: 6 },
        amountIn: new Decimal(amountIn),
        amountOut: new Decimal(4_000_000),
        minimumAmountOut: new Decimal(3_900_000),
        fees,
    }) as unknown as SwapQuote

const baseQuote = quoteWith()

const axfer = (
    overrides: Partial<{
        sender: string
        assetId: bigint
        amount: bigint
        receiver: string
        closeTo: string
        rekeyTo: string
        fee: bigint
    }> = {},
): PeraDisplayableTransaction =>
    ({
        txType: 'axfer',
        fee: overrides.fee ?? 1_000n,
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
        fee: bigint
    }> = {},
): PeraDisplayableTransaction =>
    ({
        txType: 'pay',
        fee: overrides.fee ?? 1_000n,
        sender: overrides.sender ?? SWAPPER,
        rekeyTo: overrides.rekeyTo,
        paymentTransaction: {
            amount: overrides.amount ?? 0n,
            receiver: overrides.receiver ?? POOL,
            closeRemainderTo: overrides.closeRemainderTo,
        },
    }) as unknown as PeraDisplayableTransaction

const peraFee = (assetId: string, amount: number): SwapFee => ({
    kind: 'pera',
    asset: { ...SCOPE, assetId },
    amount: new Decimal(amount),
    usdValue: null,
})

const withPeraFeeAsset = (assetId: string, amount: number): SwapQuote =>
    quoteWith({ fees: [peraFee(assetId, amount)] })

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
        // wallet must fail closed rather than sign it.
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
        // `outflow` counts only the quote's swapper, so a mismatched swapper
        // would otherwise leave the spend ceiling unchecked.
        const wrongSwapperQuote = quoteWith({
            sourceAddress: 'WRONG_SWAPPER_ADDRESS',
        })
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
        const quote = quoteWith({ sourceAddress: '' })

        expect(() => validateSwapGroupAgainstQuote([axfer()], quote)).toThrow(
            SwapQuoteMismatchError,
        )
    })

    describe('bounds the input by the request, not the router', () => {
        // The app asked to spend 5 ALGO; the router's quote claims 500.
        const inflatedQuote = quoteWith({
            sourceAssetId: '0',
            sourceAmount: 5_000_000,
            amountIn: 500_000_000,
        })

        it('rejects a group spending what the router claims', () => {
            expect(() =>
                validateSwapGroupAgainstQuote(
                    [payment({ amount: 500_000_000n })],
                    inflatedQuote,
                ),
            ).toThrow(SwapQuoteMismatchError)
        })

        it('passes a group spending exactly the requested amount', () => {
            expect(() =>
                validateSwapGroupAgainstQuote(
                    [payment({ amount: 5_000_000n })],
                    inflatedQuote,
                ),
            ).not.toThrow()
        })

        it('adds the Pera fee in the input asset on top of the request', () => {
            const quote = quoteWith({
                sourceAssetId: '0',
                sourceAmount: 5_000_000,
                amountIn: 500_000_000,
                fees: [peraFee('0', 30_000)],
            })

            expect(() =>
                validateSwapGroupAgainstQuote(
                    [payment({ amount: 5_030_000n })],
                    quote,
                ),
            ).not.toThrow()
            // Request + fee + the 0.1 ALGO network allowance, and no further.
            expect(() =>
                validateSwapGroupAgainstQuote(
                    [payment({ amount: 5_130_001n })],
                    quote,
                ),
            ).toThrow(SwapQuoteMismatchError)
        })
    })

    it('rejects a request to spend an asset on another chain', () => {
        expect(() =>
            validateSwapGroupAgainstQuote(
                [axfer()],
                quoteWith({ sourceChainId: 'ethereum' }),
            ),
        ).toThrow(SwapQuoteMismatchError)
    })

    describe('a cross-chain source leg', () => {
        const DEPOSIT = 'DEPOSIT_ADDRESS'

        const crossChain = (
            depositAddress: string | null,
            shape: QuoteShape = {},
        ): SwapQuote => ({
            ...quoteWith(shape),
            routeKind: 'cross-chain',
            depositAddress,
        })

        const appCall = (): PeraDisplayableTransaction =>
            ({
                txType: 'appl',
                fee: 1_000n,
                sender: SWAPPER,
                applicationTransaction: { applicationId: 1n },
            }) as unknown as PeraDisplayableTransaction

        it('accepts a single transfer to the deposit address within the request', () => {
            expect(() =>
                validateSwapGroupAgainstQuote(
                    [axfer({ receiver: DEPOSIT })],
                    crossChain(DEPOSIT),
                ),
            ).not.toThrow()
        })

        it('rejects a transfer to anything but the deposit address', () => {
            expect(() =>
                validateSwapGroupAgainstQuote(
                    [axfer({ receiver: 'ATTACKER' })],
                    crossChain(DEPOSIT),
                ),
            ).toThrow(SwapQuoteMismatchError)
        })

        it('rejects transfers to two receivers when the router names no deposit address', () => {
            expect(() =>
                validateSwapGroupAgainstQuote(
                    [
                        axfer({ receiver: 'FIRST', amount: 2_500_000n }),
                        axfer({ receiver: 'SECOND', amount: 2_500_000n }),
                    ],
                    crossChain(null),
                ),
            ).toThrow(SwapQuoteMismatchError)
        })

        it('ignores a zero-amount payment when counting receivers', () => {
            expect(() =>
                validateSwapGroupAgainstQuote(
                    [
                        axfer({ receiver: 'ONLY' }),
                        payment({ receiver: 'ANYONE', amount: 0n }),
                    ],
                    crossChain(null),
                ),
            ).not.toThrow()
        })

        it('rejects an application call', () => {
            expect(() =>
                validateSwapGroupAgainstQuote(
                    [axfer({ receiver: DEPOSIT }), appCall()],
                    crossChain(DEPOSIT),
                ),
            ).toThrow(SwapQuoteMismatchError)
        })

        it('rejects fees summing above 0.1 ALGO', () => {
            expect(() =>
                validateSwapGroupAgainstQuote(
                    [
                        axfer({ receiver: DEPOSIT, fee: 60_000n }),
                        payment({ receiver: DEPOSIT, fee: 40_001n }),
                    ],
                    crossChain(DEPOSIT),
                ),
            ).toThrow(SwapQuoteMismatchError)
        })

        it('rejects an input above the request even when the router claims more', () => {
            expect(() =>
                validateSwapGroupAgainstQuote(
                    [axfer({ receiver: DEPOSIT, amount: 5_000_001n })],
                    crossChain(DEPOSIT, { amountIn: 9_000_000 }),
                ),
            ).toThrow(SwapQuoteMismatchError)
        })
    })
})
