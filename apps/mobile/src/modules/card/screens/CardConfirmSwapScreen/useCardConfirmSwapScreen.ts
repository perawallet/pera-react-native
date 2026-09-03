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

import { useCallback, useMemo } from 'react'
import { Decimal } from 'decimal.js'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    useAccountBalancesInvalidator,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import {
    formatAssetAmount,
    getKnownAssetId,
    useAssetsQuery,
    type DisplayableAsset,
} from '@perawallet/wallet-core-assets'
import { apiSlippageToPercent } from '@perawallet/wallet-core-swaps'
import { type Maybe } from '@perawallet/wallet-core-shared'
import { trackEvent, CardEvent } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { type PeraCardFlowParamList } from '../../routes/types'
import { useCardAddFundsSwap } from '../CardAddFundsScreen/useCardAddFundsSwap'

const EMPTY_VALUE = '—'

type UseCardConfirmSwapScreenResult = {
    sourceAsset: Maybe<DisplayableAsset>
    usdcAsset: Maybe<DisplayableAsset>
    payDisplay: string
    receiveDisplay: string
    priceDisplay: string
    slippageDisplay: string
    priceImpactDisplay: string
    minimumReceivedDisplay: string
    exchangeFeeDisplay: string
    peraFeeDisplay: string
    /** True while the (re-fetched) quote is still loading. */
    isQuoteLoading: boolean
    isConfirmDisabled: boolean
    isConfirming: boolean
    handleConfirm: () => void
}

export const useCardConfirmSwapScreen = (): UseCardConfirmSwapScreenResult => {
    const { params } =
        useRoute<RouteProp<PeraCardFlowParamList, 'CardConfirmSwap'>>()
    const navigation =
        useNavigation<NativeStackNavigationProp<PeraCardFlowParamList>>()
    const { network } = useNetwork()
    const { t } = useLanguage()
    const { successToast, errorToast, infoToast } = useToast()
    const { invalidate: invalidateBalances } = useAccountBalancesInvalidator()

    // Same account the Add Funds screen anchors to (the active account until the
    // smart contract links a dedicated card funding source).
    const account = useSelectedAccount()

    const usdcAssetId = useMemo(
        () => getKnownAssetId('USDC', network),
        [network],
    )
    const assetIds = useMemo(
        () => [usdcAssetId, params.sourceAssetId].filter(id => id !== null),
        [usdcAssetId, params.sourceAssetId],
    )
    const { data: assets } = useAssetsQuery(assetIds)
    const usdcAsset = useMemo(
        () => (usdcAssetId === null ? undefined : assets.get(usdcAssetId)),
        [assets, usdcAssetId],
    )
    const sourceAsset = useMemo(
        () => assets.get(params.sourceAssetId),
        [assets, params.sourceAssetId],
    )
    const sourceDecimals = sourceAsset?.decimals ?? 6
    const usdcDecimals = usdcAsset?.decimals ?? 6
    const sourceUnit = sourceAsset?.unitName ?? ''
    const usdcUnit = usdcAsset?.unitName ?? 'USDC'

    const amountDecimal = useMemo(
        () => new Decimal(params.amount),
        [params.amount],
    )

    // Re-quote at confirm time so we sign the freshest rate (no need to pass the
    // non-serializable quote through navigation).
    const { quote, isQuoteFetching, isSwapping, executeSwap } =
        useCardAddFundsSwap({
            account,
            sourceAssetId: params.sourceAssetId,
            sourceDecimals,
            usdcAssetId: usdcAssetId ?? '',
            usdcDecimals,
            amount: amountDecimal,
            // No known USDC id on this network — nothing to swap into. In
            // practice this screen is unreachable in that case (Add Funds
            // never offers the swap), but the type still admits it.
            enabled: usdcAssetId !== null,
        })

    const payDisplay = useMemo(() => {
        if (!quote?.amountIn) return EMPTY_VALUE
        return formatAssetAmount(quote.amountIn, {
            decimals: sourceDecimals,
            unitName: sourceUnit,
        })
    }, [quote?.amountIn, sourceDecimals, sourceUnit])

    const receiveDisplay = useMemo(() => {
        if (!quote?.amountOut) return EMPTY_VALUE
        return formatAssetAmount(quote.amountOut, {
            decimals: usdcDecimals,
            unitName: usdcUnit,
        })
    }, [quote?.amountOut, usdcDecimals, usdcUnit])

    const priceDisplay = useMemo(() => {
        if (!quote?.price) return EMPTY_VALUE
        return `${quote.price.toDecimalPlaces(usdcDecimals).toString()} ${usdcUnit} per ${sourceUnit}`
    }, [quote?.price, usdcDecimals, usdcUnit, sourceUnit])

    const slippageDisplay = useMemo(
        () =>
            quote?.slippage
                ? `${apiSlippageToPercent(quote.slippage)}%`
                : EMPTY_VALUE,
        [quote?.slippage],
    )

    const priceImpactDisplay = useMemo(
        () =>
            quote?.priceImpact
                ? `${quote.priceImpact.toDecimalPlaces(2).toString()}%`
                : EMPTY_VALUE,
        [quote?.priceImpact],
    )

    const minimumReceivedDisplay = useMemo(() => {
        if (!quote?.amountOutWithSlippage) return EMPTY_VALUE
        return formatAssetAmount(quote.amountOutWithSlippage, {
            decimals: usdcDecimals,
            unitName: usdcUnit,
        })
    }, [quote?.amountOutWithSlippage, usdcDecimals, usdcUnit])

    const exchangeFeeDisplay = useMemo(() => {
        if (quote?.transactionFees == null) return EMPTY_VALUE
        return formatAssetAmount(quote.transactionFees, {
            decimals: sourceDecimals,
            unitName: sourceUnit,
        })
    }, [quote?.transactionFees, sourceDecimals, sourceUnit])

    const peraFeeDisplay = useMemo(
        () =>
            formatAssetAmount(quote?.peraFeeAmount ?? new Decimal(0), {
                decimals: quote?.peraFeeAsset?.decimals ?? sourceDecimals,
                unitName: quote?.peraFeeAsset?.unitName ?? sourceUnit,
            }),
        [quote?.peraFeeAmount, quote?.peraFeeAsset, sourceDecimals, sourceUnit],
    )

    const handleConfirm = useCallback(() => {
        // Design allows `card_getUSDC_confirm` for this screen too, but the
        // Get-USDC flow isn't built — this screen is only reachable from Add Funds.
        trackEvent(CardEvent.AddFundsConfirm)
        void executeSwap().then(outcome => {
            if (outcome.kind === 'success') {
                successToast(
                    t('peraCard.add_funds.swap_success_title'),
                    t('peraCard.add_funds.swap_success_body'),
                )
                invalidateBalances()
                navigation.goBack()
            } else if (outcome.kind === 'pending-cosign') {
                // Shared-account swap proposed; co-signer must approve before it
                // submits. Inform the user and leave the screen.
                successToast(
                    t('swap.execution.pending_cosign_title'),
                    t('swap.execution.pending_cosign_body'),
                )
                navigation.goBack()
            } else if (outcome.kind === 'verifying') {
                // Nothing was signed or broadcast — say so rather than leaving
                // the Confirm tap looking like a no-op.
                infoToast(
                    t('swap.execution.verifying_previous_title'),
                    t('swap.execution.verifying_previous_body'),
                )
            } else if (outcome.kind === 'error') {
                errorToast(
                    outcome.title ?? t('peraCard.add_funds.swap_error_title'),
                    outcome.message || t('peraCard.account.error_body'),
                )
            }
        })
    }, [
        executeSwap,
        successToast,
        errorToast,
        infoToast,
        t,
        invalidateBalances,
        navigation,
    ])

    return {
        sourceAsset,
        usdcAsset,
        payDisplay,
        receiveDisplay,
        priceDisplay,
        slippageDisplay,
        priceImpactDisplay,
        minimumReceivedDisplay,
        exchangeFeeDisplay,
        peraFeeDisplay,
        isQuoteLoading: isQuoteFetching && !quote,
        isConfirmDisabled: !quote || isQuoteFetching || isSwapping,
        isConfirming: isSwapping,
        handleConfirm,
    }
}
