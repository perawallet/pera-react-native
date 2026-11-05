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
import { type Nullable, type Optional } from '@perawallet/wallet-core-shared'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    addressOn,
    useAllAccounts,
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useAssetsQuery,
    formatAssetAmount,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    formatSwapRate,
    scopeOfSwapAsset,
    useSwapSourceCostQuery,
    type SwapQuote,
} from '@perawallet/wallet-core-swaps'
import { useLanguage } from '@hooks/useLanguage'
import type { SwapExecutionStatus } from '../../hooks/useSwapExecution'
import { formatSwapFee, formatSwapSlippage } from '../../utils/formatSwapFee'
import { useStyles } from './styles'

const PRICE_IMPACT_HIGH_THRESHOLD = new Decimal(5)

type UseSwapConfirmationParams = {
    scope: ChainScope
    quote: SwapQuote
    swapStatus: SwapExecutionStatus
}

export type SwapReceiveTarget = {
    /** Null when no account in the wallet holds `address`. */
    account: Nullable<WalletAccount>
    address: string
    scope: ChainScope
}

type UseSwapConfirmationResult = {
    selectedAccount: ReturnType<typeof useSelectedAccount>
    /** Where a cross-chain payout lands; null on a same-chain swap, which pays the swapper. */
    receiveTarget: Nullable<SwapReceiveTarget>
    inAsset: Optional<PeraAsset>
    outAsset: Optional<PeraAsset>
    isProcessing: boolean
    /** Preparing only — the close affordance cancels instead of trapping. */
    isCancellable: boolean
    /** Signing onward — the sheet stays until the outcome lands. */
    isCommitted: boolean
    payDisplay: string
    receiveDisplay: string
    /** In the preferred currency; null until a rate resolves. */
    payFiatValue: Nullable<Decimal>
    receiveFiatValue: Nullable<Decimal>
    rateDisplay: string
    /** Null when the route sets no minimum. */
    minimumReceivedDisplay: Nullable<string>
    /** Null when the quote carries no Pera fee. */
    peraFeeDisplay: Nullable<string>
    /** Null when the quote carries no provider fee: some providers price theirs into the rate. */
    providerFeeDisplay: Nullable<string>
    /** The source chain's own estimate, else the quote's; null when neither has one. */
    networkFeeDisplay: Nullable<string>
    needsSpendApproval: boolean
    /** Non-null while the account can't pay the source chain's fee: confirm stays off. */
    insufficientFeeMessage: Nullable<string>
    /** Null when the router chose the slippage. */
    slippageDisplay: Nullable<string>
    hasHighPriceImpact: boolean
    /** Null when the route reports no price impact. */
    priceImpactDisplay: Nullable<string>
    priceImpactStyle: object
    /** Set on a cross-chain swap, whose payout lands after this sheet closes. */
    crossChainNote: Nullable<string>
}

export const useSwapConfirmation = ({
    scope,
    quote,
    swapStatus,
}: UseSwapConfirmationParams): UseSwapConfirmationResult => {
    const styles = useStyles()
    const { t } = useLanguage()
    const selectedAccount = useSelectedAccount()
    const accounts = useAllAccounts()
    const { usdToPreferred } = useCurrency(scope)
    const { sourceCost } = useSwapSourceCostQuery({ quote, scope })

    const assetInId = quote.assetIn.assetId
    const assetOutId = quote.assetOut.assetId
    const { data: inAssets } = useAssetsQuery(scope, [assetInId])
    const { data: outAssets } = useAssetsQuery(
        scopeOfSwapAsset(quote.assetOut.ref),
        [assetOutId],
    )
    const receiveTarget = useMemo<Nullable<SwapReceiveTarget>>(() => {
        if (quote.routeKind !== 'cross-chain') return null
        const { destinationAddress, destinationAsset } = quote.request
        const receiveScope = scopeOfSwapAsset(destinationAsset)
        return {
            account:
                accounts.find(
                    account =>
                        addressOn(account, receiveScope) === destinationAddress,
                ) ?? null,
            address: destinationAddress,
            scope: receiveScope,
        }
    }, [quote, accounts])

    const inAsset = inAssets?.get(assetInId)
    const outAsset = outAssets?.get(assetOutId)

    const isProcessing =
        swapStatus === 'preparing' ||
        swapStatus === 'signing' ||
        swapStatus === 'submitting' ||
        swapStatus === 'updating-status'
    // Preparing hasn't signed or broadcast anything yet — the sheet's close
    // affordance cancels cleanly instead of trapping the user.
    const isCancellable = swapStatus === 'preparing'
    const isCommitted = isProcessing && !isCancellable

    const payDisplay = useMemo(() => {
        if (!quote.amountIn) return '-'
        return formatAssetAmount(quote.amountIn, {
            decimals: quote.assetIn.decimals,
        })
    }, [quote.amountIn, quote.assetIn])

    const receiveDisplay = useMemo(() => {
        if (!quote.amountOut) return '-'
        return formatAssetAmount(quote.amountOut, {
            decimals: quote.assetOut.decimals,
        })
    }, [quote.amountOut, quote.assetOut])

    // No rate yet gives null, so the fiat line is omitted rather than quoting
    // the swap at 0.
    const payFiatValue = useMemo(
        () =>
            quote.amountInUsdValue
                ? usdToPreferred(new Decimal(quote.amountInUsdValue))
                : null,
        [quote.amountInUsdValue, usdToPreferred],
    )

    const receiveFiatValue = useMemo(
        () =>
            quote.amountOutUsdValue
                ? usdToPreferred(new Decimal(quote.amountOutUsdValue))
                : null,
        [quote.amountOutUsdValue, usdToPreferred],
    )

    const rateDisplay = useMemo(() => formatSwapRate(quote), [quote])

    const minimumReceivedDisplay = useMemo(() => {
        if (!quote.minimumAmountOut) return null
        return formatAssetAmount(quote.minimumAmountOut, quote.assetOut)
    }, [quote.minimumAmountOut, quote.assetOut])

    const peraFeeDisplay = useMemo(() => formatSwapFee(quote, 'pera'), [quote])

    const providerFeeDisplay = useMemo(
        () => formatSwapFee(quote, 'provider'),
        [quote],
    )

    const networkFeeDisplay = useMemo(() => {
        if (!sourceCost) return formatSwapFee(quote, 'network')
        const { networkFee, nativeDecimals, nativeSymbol } = sourceCost
        return formatAssetAmount(networkFee, {
            decimals: nativeDecimals,
            unitName: nativeSymbol,
        })
    }, [sourceCost, quote])

    const insufficientFeeMessage = sourceCost?.shortfall
        ? t('swap.quote.insufficient_network_fee', {
              symbol: sourceCost.nativeSymbol,
          })
        : null

    const slippageDisplay = useMemo(
        () => (quote.request.slippage ? formatSwapSlippage(quote) : null),
        [quote],
    )

    const hasHighPriceImpact = useMemo(
        () =>
            quote.priceImpact?.greaterThanOrEqualTo(
                PRICE_IMPACT_HIGH_THRESHOLD,
            ) ?? false,
        [quote.priceImpact],
    )

    const priceImpactDisplay = useMemo(() => {
        if (!quote.priceImpact) return null
        return `${quote.priceImpact.toDecimalPlaces(2).toString()}%`
    }, [quote.priceImpact])

    const priceImpactStyle = useMemo(() => {
        if (!quote.priceImpact) return styles.detailValue
        if (quote.priceImpact.lessThan(1)) return styles.priceImpactLow
        if (quote.priceImpact.lessThan(PRICE_IMPACT_HIGH_THRESHOLD))
            return styles.priceImpactMedium
        return styles.priceImpactHigh
    }, [quote.priceImpact, styles])

    const crossChainNote = useMemo(() => {
        if (!receiveTarget) return null
        const { chainId } = receiveTarget.scope
        return t('swap.quote.cross_chain_note', {
            asset: quote.assetOut.unitName ?? quote.assetOut.assetId,
            network: chainDisplayNameOf(chainId) ?? chainId,
        })
    }, [receiveTarget, quote.assetOut, t])

    return {
        selectedAccount,
        receiveTarget,
        inAsset,
        outAsset,
        isProcessing,
        isCancellable,
        isCommitted,
        payDisplay,
        receiveDisplay,
        payFiatValue,
        receiveFiatValue,
        rateDisplay,
        minimumReceivedDisplay,
        peraFeeDisplay,
        providerFeeDisplay,
        networkFeeDisplay,
        needsSpendApproval: sourceCost?.needsSpendApproval ?? false,
        insufficientFeeMessage,
        slippageDisplay,
        hasHighPriceImpact,
        priceImpactDisplay,
        priceImpactStyle,
        crossChainNote,
    }
}
