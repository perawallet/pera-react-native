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

import { queryClient, type Network } from '@perawallet/wallet-core-shared'
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
        peraFeeAmount: parsed.pera_fee_amount,
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
        amount: parsed.amount,
        peraFee: parsed.pera_fee,
        peraFeeAssetId: parsed.pera_fee_asset_id,
    }
}

export const createQuotes = async (
    data: CreateQuotesRequest,
    network: Network,
): Promise<SwapQuote[]> => {
    const response = await queryClient<CreateQuotesApiResponse>({
        backend: 'pera',
        network,
        method: 'POST',
        url: `/v2/dex-swap/quotes/`,
        data,
    })

    const parsed = createQuotesResponseSchema.parse(response.data)
    return parsed.results.map(quote => ({
        id: quote.id,
        quoteIdStr: quote.quote_id_str,
        provider: quote.provider,
        swapType: quote.swap_type,
        swapperAddress: quote.swapper_address,
        device: quote.device,
        assetIn: transformDexSwapAsset(quote.asset_in),
        assetOut: transformDexSwapAsset(quote.asset_out),
        amountIn: quote.amount_in,
        amountInWithSlippage: quote.amount_in_with_slippage,
        amountInUsdValue: quote.amount_in_usd_value,
        amountOut: quote.amount_out,
        amountOutWithSlippage: quote.amount_out_with_slippage,
        amountOutUsdValue: quote.amount_out_usd_value,
        slippage: quote.slippage,
        price: quote.price,
        priceImpact: quote.price_impact,
        peraFeeAmount: quote.pera_fee_amount,
        exchangeFeeAmount: quote.exchange_fee_amount,
        transactionFees: quote.transaction_fees,
    }))
}
