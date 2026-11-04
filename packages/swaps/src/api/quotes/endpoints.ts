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

import type { SwapQuote, SwapQuoteRequest } from '../../models'
import { SwapQuoteMismatchError } from '../../errors'
import { routerRequest } from '../router-request'
import {
    routerAccountId,
    routerAssetIdOf,
    scopeOfSwapAsset,
    swapAssetRefOf,
    type ResolveSwapAssetRef,
} from '../router-ids'
import {
    createSwapQuotesResponseSchema,
    type CreateSwapQuotesRequest,
} from './schema'
import { transformSwapQuote } from './transformers'

export const toCreateSwapQuotesRequest = (
    request: SwapQuoteRequest,
): CreateSwapQuotesRequest => ({
    source_asset_id: routerAssetIdOf(request.sourceAsset),
    destination_asset_id: routerAssetIdOf(request.destinationAsset),
    source_amount: request.sourceAmount.toFixed(0),
    source_account: routerAccountId(
        scopeOfSwapAsset(request.sourceAsset),
        request.sourceAddress,
    ),
    destination_account: routerAccountId(
        scopeOfSwapAsset(request.destinationAsset),
        request.destinationAddress,
    ),
    ...(request.slippage !== null ? { slippage: request.slippage } : {}),
})

/**
 * Offers best first; empty when no route answers for the amount. Each offer
 * keeps the request it answers: execution validates against that, never
 * against the offer's own figures.
 */
export const createSwapQuotes = async (
    request: SwapQuoteRequest,
    resolve: ResolveSwapAssetRef = swapAssetRefOf,
): Promise<SwapQuote[]> => {
    const body = toCreateSwapQuotesRequest(request)
    const data = await routerRequest({
        scope: scopeOfSwapAsset(request.sourceAsset),
        method: 'POST',
        path: 'quotes/',
        data: body,
    })
    const parsed = createSwapQuotesResponseSchema.parse(data)

    // An offer for another asset or amount than the one asked for is not an
    // answer to this request: refuse it rather than silently correcting it.
    for (const offer of parsed.results) {
        if (
            offer.source_asset.asset_id !== body.source_asset_id ||
            offer.destination_asset.asset_id !== body.destination_asset_id ||
            offer.source_amount !== body.source_amount
        ) {
            throw new SwapQuoteMismatchError(
                'Quote does not match the requested assets and amount',
            )
        }
    }

    return parsed.results.map(offer =>
        transformSwapQuote(offer, request, resolve),
    )
}
