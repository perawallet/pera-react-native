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

import { useMemo } from 'react'
import { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    nativeAssetFor,
    useAssetPricesQuery,
} from '@perawallet/wallet-core-assets'
import {
    HIGH_NETWORK_FEE_SHARE_PERCENT,
    swapNetworkFeeSharePercent,
    swapNetworkFeeUsd,
    type SwapQuote,
    type SwapSourceCost,
} from '@perawallet/wallet-core-swaps'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useSwapFiatText } from '../../hooks/useSwapFiatText'

type UseSwapNetworkFeeWarningParams = {
    quote: SwapQuote
    scope: ChainScope
    sourceCost: Nullable<SwapSourceCost>
    isSourceCostLoading: boolean
}

/** Null unless the network fee is more than 10% of the swap's value; it warns, never blocks. */
export const useSwapNetworkFeeWarning = ({
    quote,
    scope,
    sourceCost,
    isSourceCostLoading,
}: UseSwapNetworkFeeWarningParams): Nullable<string> => {
    const { t } = useLanguage()
    const toFiatText = useSwapFiatText(scope)
    const nativeAssetId = nativeAssetFor(scope.chainId).assetId
    const { data: nativePrices } = useAssetPricesQuery(scope, [nativeAssetId])
    const nativeUsdPrice = nativePrices?.get(nativeAssetId)?.usdPrice

    return useMemo(() => {
        // Waits like the fee row does, so the warning can't flip once the estimate lands.
        if (isSourceCostLoading) return null
        const networkFeeUsd = swapNetworkFeeUsd({
            quote,
            scope,
            sourceCost,
            nativeUsdPrice,
        })
        if (!networkFeeUsd) return null
        const share = swapNetworkFeeSharePercent(quote, networkFeeUsd)
        if (!share?.greaterThan(HIGH_NETWORK_FEE_SHARE_PERCENT)) return null
        const fee = toFiatText(networkFeeUsd, Decimal.ROUND_UP)
        if (!fee) return null
        return t('swap.quote.high_network_fee_warning', {
            fee,
            // Rounded up so a share just over the threshold never reads as 10%.
            percent: share.toDecimalPlaces(0, Decimal.ROUND_UP).toString(),
        })
    }, [
        isSourceCostLoading,
        quote,
        scope,
        sourceCost,
        nativeUsdPrice,
        toFiatText,
        t,
    ])
}
