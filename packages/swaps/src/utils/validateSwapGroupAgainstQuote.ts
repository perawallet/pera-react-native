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

import type { Decimal } from 'decimal.js'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import type { SwapQuote } from '../models'

const ALGO_ASSET_ID = '0'

// Absorbs the few µAlgo of network fees (and any small native-ALGO movement a
// provider may route through a payment `amount` rather than the `fee` field) so
// a legitimate swap is never falsely rejected. Bounds an unexpected ALGO drain
// to a negligible amount.
const NETWORK_FEE_ALLOWANCE_MICRO_ALGO = 100_000n // 0.1 ALGO

/** Thrown when a prepared swap group spends more than the reviewed quote allows. */
export class SwapQuoteMismatchError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'SwapQuoteMismatchError'
    }
}

const toBig = (value: bigint | number | undefined): bigint => {
    if (typeof value === 'bigint') return value
    if (typeof value === 'number') return BigInt(Math.trunc(value))
    return 0n
}

/** Ceil a base-unit Decimal to a bigint upper bound (never under-bounds). */
const ceilToBig = (value: Decimal | undefined): bigint =>
    value ? BigInt(value.ceil().toFixed(0)) : 0n

/**
 * Fail-closed check that a backend-assembled swap group only spends what the
 * reviewed quote implies. Swap flows trust the group built by the backend and
 * skip the standard signing review sheet, so this guards against a
 * compromised/buggy backend exfiltrating funds.
 *
 * Verified over the user-signable transactions (those sent by the swapper) —
 * which are the *complete* set of ways the swapper's funds can leave. Inner
 * transactions produced by the DEX app spend the pool/app's funds, not the
 * user's, so they need no inspection here (and the minimum received is enforced
 * on-chain by the router). The checks:
 *  - no rekey of the swapper's account (would hand control to a third party);
 *  - no close-remainder / close-to (a swap must never empty the account/asset);
 *  - no outflow of an asset other than the quoted input, ALGO (fees), or the
 *    Pera fee asset (an unexpected asset gets a 0 bound, so it trips over-spend);
 *  - the input / ALGO / Pera-fee asset is not spent beyond the quoted amounts.
 *    Bounds are additive, so when the input and Pera-fee asset are the same the
 *    allowance is correctly their sum.
 *
 * Throws {@link SwapQuoteMismatchError} on any violation; callers must treat a
 * throw as "do not sign".
 */
export const validateSwapGroupAgainstQuote = (
    signableTransactions: PeraDisplayableTransaction[],
    quote: SwapQuote,
): void => {
    const swapper = quote.swapperAddress
    if (!swapper) {
        throw new SwapQuoteMismatchError(
            'Swap quote is missing the swapper address',
        )
    }

    const inputAssetId = quote.assetIn.assetId
    const peraFeeAssetId = quote.peraFeeAsset?.assetId
    const maxInput = ceilToBig(quote.amountInWithSlippage ?? quote.amountIn)
    const maxPeraFee = ceilToBig(quote.peraFeeAmount)

    // Upper bound the swapper may spend per asset. Anything not listed gets a 0
    // bound, so both an unexpected-asset outflow and an over-spend trip the same
    // check. Bounds are summed: if the input and Pera-fee asset are the same,
    // the allowance is `maxInput + maxPeraFee` (both are spent in that asset).
    // Rounded up so rounding can never falsely reject.
    const boundFor = (assetId: string): bigint =>
        (assetId === inputAssetId ? maxInput : 0n) +
        (assetId === peraFeeAssetId ? maxPeraFee : 0n) +
        (assetId === ALGO_ASSET_ID ? NETWORK_FEE_ALLOWANCE_MICRO_ALGO : 0n)

    const outflow = new Map<string, bigint>()
    const addOutflow = (assetId: string, amount: bigint): void => {
        outflow.set(assetId, (outflow.get(assetId) ?? 0n) + amount)
    }

    for (const tx of signableTransactions) {
        // Fail closed: a slot the wallet will sign whose sender is not the
        // swapper is outside everything the user reviewed. Skipping it (the
        // previous behaviour) meant its rekey/close/outflow was never
        // inspected — and a wrong `swapper` turned the whole validator into a
        // no-op, since `outflow` is only populated inside this branch, so an
        // arbitrary drain of the account passed.
        if (tx.sender !== swapper) {
            throw new SwapQuoteMismatchError(
                'Swap group contains a signable transaction from an unexpected sender',
            )
        }

        if (tx.rekeyTo) {
            throw new SwapQuoteMismatchError(
                'Swap transaction rekeys the account',
            )
        }

        const payment = tx.paymentTransaction
        if (payment) {
            if (payment.closeRemainderTo) {
                throw new SwapQuoteMismatchError(
                    'Swap transaction closes the account',
                )
            }
            addOutflow(ALGO_ASSET_ID, toBig(payment.amount))
        }

        const axfer = tx.assetTransferTransaction
        if (axfer) {
            if (axfer.closeTo) {
                throw new SwapQuoteMismatchError(
                    'Swap transaction closes out an asset',
                )
            }
            addOutflow(axfer.assetId.toString(), toBig(axfer.amount))
        }
    }

    for (const [assetId, spent] of outflow) {
        if (spent > boundFor(assetId)) {
            throw new SwapQuoteMismatchError(
                `Swap spends more of asset ${assetId} than the quote allows`,
            )
        }
    }
}
