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
import {
    assetRefKey,
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    baseUnitsToDisplayUnits,
    type Maybe,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { SwapSourceCost } from '../chain-adapter'
import type { SwapFee, SwapFeeKind, SwapQuote } from '../models'

/** The quote's first fee of `kind`; with `scope`, the first charged there. */
export const swapFeeOf = (
    quote: SwapQuote,
    kind: SwapFeeKind,
    scope?: ChainScope,
): Optional<SwapFee> =>
    quote.fees.find(
        fee =>
            fee.kind === kind &&
            (!scope || toScopeKey(fee.asset) === toScopeKey(scope)),
    )

/**
 * Base units of the source asset the Pera fee takes on top of the swapped
 * amount; zero when it is charged in another asset.
 */
export const peraFeeInSourceAsset = (quote: SwapQuote): Decimal => {
    const fee = swapFeeOf(quote, 'pera')
    return fee &&
        assetRefKey(fee.asset) === assetRefKey(quote.request.sourceAsset)
        ? fee.amount
        : new Decimal(0)
}

/** Percent of a swap's USD value above which its network fee is worth a warning. */
export const HIGH_NETWORK_FEE_SHARE_PERCENT = new Decimal(10)

/**
 * The source chain's network fee in USD, as the swap is likely to pay it: the
 * router's own figure when the quote carries one, else the chain's expected
 * estimate at the native price. Never the signed maximum, which would overstate
 * the fee several times. Null when neither is known.
 */
export const swapNetworkFeeUsd = ({
    quote,
    scope,
    sourceCost,
    nativeUsdPrice,
}: {
    quote: SwapQuote
    scope: ChainScope
    sourceCost: Nullable<SwapSourceCost>
    nativeUsdPrice: Maybe<Decimal>
}): Nullable<Decimal> => {
    const quotedUsd = swapFeeOf(quote, 'network', scope)?.usdValue
    if (quotedUsd) return new Decimal(quotedUsd)
    if (!sourceCost || !nativeUsdPrice?.greaterThan(0)) return null
    return baseUnitsToDisplayUnits(
        sourceCost.expectedNetworkFee,
        sourceCost.nativeDecimals,
    ).mul(nativeUsdPrice)
}

/** `networkFeeUsd` as a percent of the swap's USD value; null when the swap has no value. */
export const swapNetworkFeeSharePercent = (
    quote: SwapQuote,
    networkFeeUsd: Decimal,
): Nullable<Decimal> => {
    if (!quote.amountInUsdValue) return null
    const swapUsd = new Decimal(quote.amountInUsdValue)
    return swapUsd.greaterThan(0) ? networkFeeUsd.div(swapUsd).mul(100) : null
}
