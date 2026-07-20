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
import {
    formatCurrency,
    formatNumber,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import {
    useAssetsQuery,
    formatAssetAmount,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    apiSlippageToPercent,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'
import type { SwapExecutionStatus } from '../../hooks/useSwapExecution'
import { useStyles } from './styles'

const PRICE_IMPACT_HIGH_THRESHOLD = new Decimal(5)

type UseSwapConfirmationParams = {
    quote: Nullable<SwapQuote>
    swapStatus: SwapExecutionStatus
}

type UseSwapConfirmationResult = {
    selectedAccount: ReturnType<typeof useSelectedAccount>
    inAsset: Optional<PeraAsset>
    outAsset: Optional<PeraAsset>
    isProcessing: boolean
    /** Preparing only — the close affordance cancels instead of trapping. */
    isCancellable: boolean
    /** Signing onward — the sheet stays until the outcome lands. */
    isCommitted: boolean
    payDisplay: string
    receiveDisplay: string
    payFiatDisplay: Optional<string>
    receiveFiatDisplay: Optional<string>
    rateDisplay: string
    minimumReceivedDisplay: string
    peraFeeDisplay: string
    slippageDisplay: string
    hasHighPriceImpact: boolean
    priceImpactDisplay: string
    priceImpactStyle: object
}

export const useSwapConfirmation = ({
    quote,
    swapStatus,
}: UseSwapConfirmationParams): UseSwapConfirmationResult => {
    const styles = useStyles()
    const selectedAccount = useSelectedAccount()
    const { preferredCurrency, usdToPreferred } = useCurrency()

    const assetInId = quote?.assetIn.assetId
    const assetOutId = quote?.assetOut.assetId
    const { data: inAssets } = useAssetsQuery(assetInId ? [assetInId] : [])
    const { data: outAssets } = useAssetsQuery(assetOutId ? [assetOutId] : [])
    const inAsset = assetInId ? inAssets?.get(assetInId) : undefined
    const outAsset = assetOutId ? outAssets?.get(assetOutId) : undefined

    const isProcessing =
        swapStatus === 'preparing' ||
        swapStatus === 'signing' ||
        swapStatus === 'submitting' ||
        swapStatus === 'updating-status'
    // Preparing hasn't signed or broadcast anything yet — the sheet's close
    // affordance cancels cleanly instead of trapping the user (PERA-4589).
    const isCancellable = swapStatus === 'preparing'
    const isCommitted = isProcessing && !isCancellable

    const payDisplay = useMemo(() => {
        if (!quote?.amountIn) return '-'
        return formatAssetAmount(quote.amountIn, {
            decimals: quote.assetIn.decimals,
        })
    }, [quote?.amountIn, quote?.assetIn])

    const receiveDisplay = useMemo(() => {
        if (!quote?.amountOut) return '-'
        return formatAssetAmount(quote.amountOut, {
            decimals: quote.assetOut.decimals,
        })
    }, [quote?.amountOut, quote?.assetOut])

    const payFiatDisplay = useMemo(() => {
        if (!quote?.amountInUsdValue) return undefined
        const value = usdToPreferred(new Decimal(quote.amountInUsdValue))
        return formatCurrency(value, 2, preferredCurrency)
    }, [quote?.amountInUsdValue, usdToPreferred, preferredCurrency])

    const receiveFiatDisplay = useMemo(() => {
        if (!quote?.amountOutUsdValue) return undefined
        const value = usdToPreferred(new Decimal(quote.amountOutUsdValue))
        return formatCurrency(value, 2, preferredCurrency)
    }, [quote?.amountOutUsdValue, usdToPreferred, preferredCurrency])

    const rateDisplay = useMemo(() => {
        if (!quote?.price) return '-'
        const outDecimals = quote.assetOut.decimals ?? 6
        const { sign, integer, fraction } = formatNumber(
            quote.price,
            outDecimals,
            undefined,
            2,
        )
        return `1 ${quote.assetIn.unitName ?? ''} ≈ ${sign}${integer}${fraction} ${quote.assetOut.unitName ?? ''}`
    }, [quote?.price, quote?.assetIn, quote?.assetOut])

    const minimumReceivedDisplay = useMemo(() => {
        if (!quote?.amountOutWithSlippage) return '-'
        return formatAssetAmount(quote.amountOutWithSlippage, quote.assetOut)
    }, [quote?.amountOutWithSlippage, quote?.assetOut])

    const peraFeeDisplay = useMemo(() => {
        if (!quote?.peraFeeAmount) return '-'
        return formatAssetAmount(
            quote.peraFeeAmount,
            quote.peraFeeAsset ?? quote.assetIn,
        )
    }, [quote?.peraFeeAmount, quote?.peraFeeAsset, quote?.assetIn])

    const slippageDisplay = useMemo(() => {
        if (!quote?.slippage) return '-'
        return `${apiSlippageToPercent(quote.slippage)}%`
    }, [quote?.slippage])

    const hasHighPriceImpact = useMemo(
        () =>
            quote?.priceImpact?.greaterThanOrEqualTo(
                PRICE_IMPACT_HIGH_THRESHOLD,
            ) ?? false,
        [quote?.priceImpact],
    )

    const priceImpactDisplay = useMemo(() => {
        if (!quote?.priceImpact) return '-'
        return `${quote.priceImpact.toDecimalPlaces(2).toString()}%`
    }, [quote?.priceImpact])

    const priceImpactStyle = useMemo(() => {
        if (!quote?.priceImpact) return styles.detailValue
        if (quote.priceImpact.lessThan(1)) return styles.priceImpactLow
        if (quote.priceImpact.lessThan(PRICE_IMPACT_HIGH_THRESHOLD))
            return styles.priceImpactMedium
        return styles.priceImpactHigh
    }, [quote?.priceImpact, styles])

    return {
        selectedAccount,
        inAsset,
        outAsset,
        isProcessing,
        isCancellable,
        isCommitted,
        payDisplay,
        receiveDisplay,
        payFiatDisplay,
        receiveFiatDisplay,
        rateDisplay,
        minimumReceivedDisplay,
        peraFeeDisplay,
        slippageDisplay,
        hasHighPriceImpact,
        priceImpactDisplay,
        priceImpactStyle,
    }
}
