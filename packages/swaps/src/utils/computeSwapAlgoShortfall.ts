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
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { SwapQuote } from '../models'

const ALGO_ASSET_ID = '0'
const ZERO = new Decimal(0)

export type SwapAlgoShortfallInput = {
    quote: SwapQuote
    /** Sender's current ALGO balance, in microAlgos. */
    algoBalance: Decimal
    /** Sender's current minimum balance requirement, in microAlgos. */
    minBalance: Decimal
    /**
     * MBR increase the group's receive-asset opt-in will add, in microAlgos.
     * Omit (or pass zero) when the account already holds the receive asset.
     */
    optInMbr?: Decimal
}

/**
 * Mirror of the backend's prepare-time ALGO balance validation
 * (`PrepareTransactionsV2Serializer._validate_account_balance`), so a
 * shortfall fails before prepare with actionable copy instead of a generic
 * 400. Two deliberate backend quirks are preserved: the post-swap balance is
 * checked BEFORE crediting an ALGO output (algod evaluates group slots
 * sequentially, so the balance can dip mid-group), and the output credit
 * only counts toward the pera fee.
 *
 * Returns the microAlgo shortfall, or `null` when the account can fund the
 * swap. Asset-denominated shortfalls (input amount, pera fee owed in an ASA)
 * are out of scope — the form's balance check and the backend cover those.
 */
export const computeSwapAlgoShortfall = ({
    quote,
    algoBalance,
    minBalance,
    optInMbr,
}: SwapAlgoShortfallInput): Nullable<Decimal> => {
    const fees = quote.transactionFees ?? ZERO
    const amountIn = quote.amountInWithSlippage ?? quote.amountIn ?? ZERO
    const amountOut = quote.amountOutWithSlippage ?? quote.amountOut ?? ZERO
    const peraFee = quote.peraFeeAmount ?? ZERO

    const isAlgoIn = quote.assetIn.assetId === ALGO_ASSET_ID
    const isAlgoOut = quote.assetOut.assetId === ALGO_ASSET_ID
    const isPeraFeeInAlgo =
        quote.peraFeeAsset == null ||
        quote.peraFeeAsset.assetId === ALGO_ASSET_ID

    const required = minBalance.plus(optInMbr ?? ZERO)

    const afterSwap = algoBalance.minus(fees).minus(isAlgoIn ? amountIn : ZERO)
    const afterPeraFee = afterSwap
        .plus(isAlgoOut ? amountOut : ZERO)
        .minus(isPeraFeeInAlgo ? peraFee : ZERO)

    const shortfall = Decimal.max(
        required.minus(afterSwap),
        required.minus(afterPeraFee),
    )

    return shortfall.greaterThan(0) ? shortfall : null
}
