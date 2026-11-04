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
import {
    swapFeeOf,
    type SwapFee,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'
import type { Optional } from '@perawallet/wallet-core-shared'
import { toScopeKey } from '@perawallet/wallet-core-chain-contract'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { isAlgorandNativeAssetId } from '../descriptor'

const ZERO = new Decimal(0)

const isAlgoFee = (fee: Optional<SwapFee>): boolean =>
    fee !== undefined &&
    fee.asset.chainId === ALGORAND_CHAIN_ID &&
    isAlgorandNativeAssetId(fee.asset.assetId)

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
 * Mirror of the backend's ALGO balance validation on order creation, so a
 * shortfall fails before the order is placed with actionable copy instead of
 * a generic 400. Two deliberate backend quirks are preserved: the post-swap balance is
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
    const networkFee = swapFeeOf(quote, 'network')
    const fees = isAlgoFee(networkFee) ? (networkFee?.amount ?? ZERO) : ZERO
    const amountIn = quote.request.sourceAmount
    const amountOut = quote.minimumAmountOut ?? quote.amountOut
    const peraFee = swapFeeOf(quote, 'pera')

    const isAlgoIn = isAlgorandNativeAssetId(quote.request.sourceAsset.assetId)
    // A cross-chain output pays out on another chain, where an id of "0" isn't ALGO.
    const isAlgoOut =
        toScopeKey(quote.assetOut.ref) ===
            toScopeKey(quote.request.sourceAsset) &&
        isAlgorandNativeAssetId(quote.assetOut.assetId)
    const peraFeeInAlgo = peraFee && isAlgoFee(peraFee) ? peraFee.amount : ZERO

    const required = minBalance.plus(optInMbr ?? ZERO)

    const afterSwap = algoBalance.minus(fees).minus(isAlgoIn ? amountIn : ZERO)
    const afterPeraFee = afterSwap
        .plus(isAlgoOut ? amountOut : ZERO)
        .minus(peraFeeInAlgo)

    const shortfall = Decimal.max(
        required.minus(afterSwap),
        required.minus(afterPeraFee),
    )

    return shortfall.greaterThan(0) ? shortfall : null
}
