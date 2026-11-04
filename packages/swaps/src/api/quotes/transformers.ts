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

import { toScopeKey } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type {
    SwapAsset,
    SwapAssetRef,
    SwapFee,
    SwapQuote,
    SwapQuoteRequest,
    SwapRouteKind,
} from '../../models'
import { SwapQuoteMismatchError } from '../../errors'
import { transformSwapAsset } from '../assets/transformers'
import type { ResolveSwapAssetRef } from '../router-ids'
import type { SwapOfferApiResponse } from './schema'

const routeKindOf = (from: SwapAssetRef, to: SwapAssetRef): SwapRouteKind =>
    toScopeKey(from) === toScopeKey(to) ? 'single-chain' : 'cross-chain'

export const toEpochMs = (iso: Nullable<string>): Nullable<number> => {
    if (iso === null) return null
    const ms = new Date(iso).getTime()
    return Number.isNaN(ms) ? null : ms
}

const requireAsset = (asset: Nullable<SwapAsset>, leg: string): SwapAsset => {
    if (!asset) {
        throw new SwapQuoteMismatchError(`Quote ${leg} asset is not swappable`)
    }
    return asset
}

/**
 * Throws when an offer's leg can't be read as a wallet asset. A fee in an
 * asset no swap chain can read is dropped: it is for display only.
 */
export const transformSwapQuote = (
    offer: SwapOfferApiResponse,
    request: SwapQuoteRequest,
    resolve: ResolveSwapAssetRef,
): SwapQuote => {
    const assetIn = requireAsset(
        transformSwapAsset(offer.source_asset, resolve),
        'source',
    )
    const assetOut = requireAsset(
        transformSwapAsset(offer.destination_asset, resolve),
        'destination',
    )
    const fees = offer.fees.flatMap((fee): SwapFee[] => {
        const asset = resolve(fee.asset_id)
        return asset
            ? [
                  {
                      kind: fee.kind,
                      asset,
                      amount: new Decimal(fee.amount),
                      usdValue: fee.usd_value,
                  },
              ]
            : []
    })
    const priceImpact = offer.extras?.price_impact
    return {
        quoteId: offer.quote_id,
        request,
        provider: offer.provider,
        routeKind: routeKindOf(assetIn.ref, assetOut.ref),
        assetIn,
        assetOut,
        amountIn: new Decimal(offer.source_amount),
        amountOut: new Decimal(offer.destination_amount_expected),
        minimumAmountOut:
            offer.destination_amount_minimum === null
                ? null
                : new Decimal(offer.destination_amount_minimum),
        amountInUsdValue: offer.source_amount_usd_value,
        amountOutUsdValue: offer.destination_amount_usd_value,
        fees,
        priceImpact:
            priceImpact === null || priceImpact === undefined
                ? null
                : new Decimal(priceImpact),
        expiresAt: toEpochMs(offer.expires_at),
        fetchedAt: Date.now(),
        depositAddress: offer.deposit_address ?? null,
    }
}
