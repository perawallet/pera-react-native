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
    queryClient,
    type Network,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    calculatePeraFeeResponseSchema,
    calculateSwapAmountResponseSchema,
    createQuotesResponseSchema,
    type CalculatePeraFeeRequest,
    type CalculateSwapAmountRequest,
    type CreateQuotesRequest,
    type CalculatePeraFeeApiResponse,
    type CalculateSwapAmountApiResponse,
    type CreateQuotesApiResponse,
} from './schema'
import { transformDexSwapAsset } from '../available-assets/transformers'
import type {
    CalculatePeraFeeResult,
    CalculateSwapAmountResult,
    SwapProviderItem,
    SwapQuote,
} from '../../models'

export const calculatePeraFee = async (
    data: CalculatePeraFeeRequest,
    network: Network,
): Promise<CalculatePeraFeeResult> => {
    const response = await queryClient<CalculatePeraFeeApiResponse>({
        backend: 'pera',
        network,
        method: 'POST',
        url: `/v1/dex-swap/calculate-pera-fee/`,
        data,
    })

    const parsed = calculatePeraFeeResponseSchema.parse(response.data)
    return {
        peraFeeAmount:
            parsed.pera_fee_amount !== undefined
                ? new Decimal(parsed.pera_fee_amount)
                : undefined,
        peraFeeAssetId: parsed.pera_fee_asset_id,
    }
}

export const calculateSwapAmount = async (
    data: CalculateSwapAmountRequest,
    network: Network,
): Promise<CalculateSwapAmountResult> => {
    const response = await queryClient<CalculateSwapAmountApiResponse>({
        backend: 'pera',
        network,
        method: 'POST',
        url: `/v1/dex-swap/calculate-swap-amount/`,
        data,
    })

    const parsed = calculateSwapAmountResponseSchema.parse(response.data)
    return {
        amount:
            parsed.amount !== undefined
                ? new Decimal(parsed.amount)
                : undefined,
        peraFee:
            parsed.pera_fee !== undefined
                ? new Decimal(parsed.pera_fee)
                : undefined,
        peraFeeAssetId: parsed.pera_fee_asset_id,
    }
}

export const createQuotes = async (
    data: CreateQuotesRequest,
    network: Network,
    providers: SwapProviderItem[],
): Promise<SwapQuote[]> => {
    const response = await queryClient<CreateQuotesApiResponse>({
        backend: 'pera',
        network,
        method: 'POST',
        url: `/v2/dex-swap/quotes/`,
        data,
    })

    const toOptionalDecimal = (v?: Nullable<string>): Optional<Decimal> =>
        v != null ? new Decimal(v) : undefined

    const toNullableDecimal = (v?: Nullable<string>): Nullable<Decimal> =>
        v != null ? new Decimal(v) : null

    const parsed = createQuotesResponseSchema.parse(response.data)

    // `swapperAddress` is the wallet's own trust anchor for
    // `validateSwapGroupAgainstQuote` (swaps sign headlessly). It must come
    // from the request we sent, never the response body — a backend that
    // returns a different swapper would silently disable that validator and
    // could rekey/drain the account. Hard-fail on divergence so a lying
    // backend surfaces as an error rather than being silently corrected.
    // (PERA-4709)
    for (const quote of parsed.results) {
        if (
            quote.swapper_address &&
            quote.swapper_address !== data.swapper_address
        ) {
            throw new Error(
                'Quote swapper address does not match the requested address',
            )
        }
    }

    return parsed.results.map(quote => ({
        id: quote.id,
        quoteIdStr: quote.quote_id_str,
        provider: quote.provider,
        providerDisplayName: providers.find(p => p.name === quote.provider)
            ?.displayName,
        swapType: quote.swap_type,
        swapperAddress: data.swapper_address,
        device: quote.device,
        assetIn: transformDexSwapAsset(quote.asset_in),
        assetOut: transformDexSwapAsset(quote.asset_out),
        amountIn: toOptionalDecimal(quote.amount_in),
        amountInWithSlippage: toOptionalDecimal(quote.amount_in_with_slippage),
        amountInUsdValue: quote.amount_in_usd_value,
        amountOut: toOptionalDecimal(quote.amount_out),
        amountOutWithSlippage: toOptionalDecimal(
            quote.amount_out_with_slippage,
        ),
        amountOutUsdValue: quote.amount_out_usd_value,
        slippage: toOptionalDecimal(quote.slippage),
        price: toOptionalDecimal(quote.price),
        priceImpact: toOptionalDecimal(quote.price_impact),
        peraFeeAmount: toOptionalDecimal(quote.pera_fee_amount),
        peraFeeAsset: quote.pera_fee_asset
            ? transformDexSwapAsset(quote.pera_fee_asset)
            : undefined,
        transactionFees: toNullableDecimal(quote.transaction_fees),
        // Client-stamped: the wire schema has no expiry, and the
        // confirm-time freshness guard needs a reference point.
        fetchedAt: Date.now(),
    }))
}
