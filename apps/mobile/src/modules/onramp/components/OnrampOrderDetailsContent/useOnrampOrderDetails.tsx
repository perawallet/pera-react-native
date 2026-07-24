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
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useSelectedAccountAddress } from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    useCancelRampOrderMutation,
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
    /** Payment method name; null when unavailable. */
    paymentMethodName: Nullable<string>
    /** Long datetime, e.g. "Dec 23, 2025 at 11:16 PM". */
    createdAtLabel: string
    /** "1 {SRC} ≈ {rate} {DST}" or null when amounts are missing/zero. */
    exchangeRateLabel: Nullable<string>
    /** Receiving address (XO order's `toAddress`, else the selected account). */
    toAddress: Nullable<string>
    /** Source token logo for the QR center; null when unavailable. */
    sourceLogo: Nullable<string>
    /** Pay-in (deposit) address for a pending XO order; null otherwise. */
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
    const { network } = useNetwork()
    const { dismiss } = useBottomSheetResult()
    const { request: requestBottomSheet } = useBottomSheet()
    const { successToast, errorToast } = useToast()
    const deviceId = useDeviceID(network)
    const { selectedAccountAddress } = useSelectedAccountAddress()
    const { mutateAsync: cancelOrder, isPending: isCancelling } =
        useCancelRampOrderMutation()

    const isXo = item.provider.toLowerCase() === 'xo'
    const isPendingXo =
        isXo && item.status === 'pending' && Boolean(item.payInAddress)

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
        if (!item.swapOrderId || !deviceId || !selectedAccountAddress) return

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
            await cancelOrder({
                swapOrderId: item.swapOrderId,
                deviceId,
                accountAddress: selectedAccountAddress,
            })
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
        item.swapOrderId,
        deviceId,
        selectedAccountAddress,
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
        paymentMethodName: item.paymentMethod.name || null,
        createdAtLabel: formatDatetime(
            item.creationDatetime,
            undefined,
            'medium',
        ),
        exchangeRateLabel,
        toAddress: item.toAddress ?? selectedAccountAddress ?? null,
        sourceLogo: item.pair.sourceToken.logo ?? null,
        payInAddress: item.payInAddress ?? null,
        payInAddressTag: item.payInAddressTag ?? null,
        contactOrderId: item.swapOrderId ?? item.id,
        isCancelling,
        handleCancelOrder,
    }
}
