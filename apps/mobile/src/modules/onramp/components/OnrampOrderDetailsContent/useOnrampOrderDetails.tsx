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

import { useCallback } from 'react'
import type { Decimal } from 'decimal.js'
import {
    useCancelRampOrderMutation,
    useRampDepositInstructions,
    toOnrampUserMessage,
    type OnrampStatus,
    type RampHistoryItem,
} from '@perawallet/wallet-core-onramp'
import {
    formatDatetime,
    isConnectivityError,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet, useBottomSheetResult } from '@modules/bottom-sheet'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useOnrampAccount } from '@modules/onramp/hooks/useOnrampAccount'

type UseOnrampOrderDetailsResult = {
    status: OnrampStatus
    /** Display name of the provider (e.g. "XO Swap"). */
    providerName: string
    /** True for an XO order — drives the contact-support + pay-in sections. */
    isXo: boolean
    /** True when a still-pending XO order can show the pay-in QR + cancel. */
    isPendingXo: boolean
    sourceSymbol: string
    destinationSymbol: string
    /** "{amount} {SYMBOL}" or null when the amount is missing. */
    sourceAmountLabel: Nullable<string>
    destinationAmountLabel: Nullable<string>
    /** Network display name (e.g. "Solana"); null when unavailable. */
    networkName: Nullable<string>
    /** Long datetime, e.g. "Dec 23, 2025 at 11:16 PM". */
    createdAtLabel: string
    /** "1 {SRC} ≈ {rate} {DST}" or null when amounts are missing/zero. */
    exchangeRateLabel: Nullable<string>
    /** Receiving address (the order's `toAddress`, else the selected account). */
    toAddress: Nullable<string>
    /** Source token logo for the QR center; null when unavailable. */
    sourceLogo: Nullable<string>
    /** Pay-in (deposit) address of a deposit order placed on this device; null otherwise. */
    payInAddress: Nullable<string>
    payInAddressTag: Nullable<string>
    /** Order id used to prefill the support email subject. */
    contactOrderId: string
    isCancelling: boolean
    handleCancelOrder: () => Promise<void>
}

const RATE_DECIMAL_PLACES = 4

const formatProviderName = (providerId: string): string => {
    const normalized = providerId.toLowerCase()
    if (normalized === 'xo' || normalized === 'exodus') return 'XO Swap'
    return providerId.charAt(0).toUpperCase() + providerId.slice(1)
}

const formatAmountLabel = (
    amount: Nullable<Decimal>,
    symbol: string,
): Nullable<string> => {
    if (amount === null) return null
    return `${amount.toString()} ${symbol}`
}

export const useOnrampOrderDetails = (
    item: RampHistoryItem,
): UseOnrampOrderDetailsResult => {
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult()
    const { request: requestBottomSheet } = useBottomSheet()
    const { successToast, errorToast } = useToast()
    const { scope, address: selectedAccountAddress } = useOnrampAccount()
    const { mutateAsync: cancelOrder, isPending: isCancelling } =
        useCancelRampOrderMutation()

    // A legacy order has no funding method, so its provider says what it was.
    const isXo =
        item.kind === 'xo' ||
        (item.kind === null && item.provider.toLowerCase() === 'xo')
    // The router's order items carry no deposit address; this device kept the
    // instructions of the deposit orders it placed.
    const rememberedDeposit = useRampDepositInstructions(item.id)
    const payInAddress = item.payInAddress ?? rememberedDeposit?.address ?? null
    const payInAddressTag =
        item.payInAddressTag ?? rememberedDeposit?.memo ?? null
    const isPendingXo =
        isXo && item.status === 'pending' && payInAddress !== null

    const sourceSymbol = item.pair.sourceToken.symbol
    const destinationSymbol = item.pair.destinationToken.symbol

    const exchangeRateLabel =
        item.sourceAmount !== null &&
        item.destinationAmount !== null &&
        !item.sourceAmount.isZero()
            ? `1 ${sourceSymbol} ≈ ${item.destinationAmount
                  .dividedBy(item.sourceAmount)
                  .toDecimalPlaces(RATE_DECIMAL_PLACES)
                  .toString()} ${destinationSymbol}`
            : null

    const handleCancelOrder = useCallback(async () => {
        if (item.status !== 'pending' || scope === null) return

        // Confirm before cancelling — cancellation is irreversible.
        const confirmed = await requestBottomSheet<boolean>({
            contents: (
                <ConfirmActionContent
                    icon='error-circle'
                    title={t('onramp.order_review.cancel_confirm_title')}
                    message={t('onramp.order_review.cancel_confirm_body')}
                    confirmLabel={t('onramp.order_review.cancel_order')}
                    cancelLabel={t('onramp.order_review.keep_order')}
                    confirmVariant='primary'
                    cancelVariant='secondary'
                    confirmTestID='onramp-cancel-order-confirm'
                    cancelTestID='onramp-cancel-order-keep'
                />
            ),
            options: { size: 'auto', enablePanDownToClose: true },
        })
        if (!confirmed) return

        try {
            await cancelOrder({ scope, orderId: item.id })
            dismiss()
            successToast('', t('onramp.order_review.cancel_success'))
        } catch (error) {
            if (isConnectivityError(error)) {
                errorToast(
                    t('errors.network.no_connection.title'),
                    t('errors.network.no_connection.body'),
                )
            } else {
                errorToast('', toOnrampUserMessage(error))
            }
        }
    }, [
        item.id,
        item.status,
        scope,
        cancelOrder,
        dismiss,
        requestBottomSheet,
        successToast,
        errorToast,
        t,
    ])

    return {
        status: item.status,
        providerName: formatProviderName(item.provider),
        isXo,
        isPendingXo,
        sourceSymbol,
        destinationSymbol,
        sourceAmountLabel: formatAmountLabel(item.sourceAmount, sourceSymbol),
        destinationAmountLabel: formatAmountLabel(
            item.destinationAmount,
            destinationSymbol,
        ),
        networkName: item.pair.sourceToken.network.name || null,
        createdAtLabel: formatDatetime(
            item.creationDatetime,
            undefined,
            'medium',
        ),
        exchangeRateLabel,
        toAddress: item.toAddress ?? selectedAccountAddress ?? null,
        sourceLogo: item.pair.sourceToken.logo ?? null,
        payInAddress,
        payInAddressTag,
        contactOrderId: item.id,
        isCancelling,
        handleCancelOrder,
    }
}
