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

import { type Decimal } from 'decimal.js'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'

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
 * Verified over the user-signable transactions (those sent by the swapper):
 *  - no close-remainder / close-to (a swap must never empty the account/asset);
 *  - no outflow of an asset other than the quoted input, ALGO (fees), or the
 *    Pera fee asset (an unexpected asset gets a 0 bound, so it trips over-spend);
 *  - the input / ALGO / Pera-fee asset is not spent beyond the quoted amounts.
 *
 * It does NOT verify the minimum received — that floor is enforced on-chain by
 * the swap router (the atomic group fails if the output is below it).
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
    // check. Bounds are rounded up so rounding can never falsely reject.
    const boundFor = (assetId: string): bigint =>
        (assetId === inputAssetId ? maxInput : 0n) +
        (assetId === peraFeeAssetId ? maxPeraFee : 0n) +
        (assetId === ALGO_ASSET_ID ? NETWORK_FEE_ALLOWANCE_MICRO_ALGO : 0n)

    const outflow = new Map<string, bigint>()
    const addOutflow = (assetId: string, amount: bigint): void => {
        outflow.set(assetId, (outflow.get(assetId) ?? 0n) + amount)
    }

    for (const tx of signableTransactions) {
        // Only the swapper's own transactions move the swapper's funds.
        if (tx.sender !== swapper) continue

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
