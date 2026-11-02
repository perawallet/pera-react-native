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
import {
    getAssetTransferType,
    getTransactionType,
    type AlgorandTransactionView,
} from '@perawallet/wallet-core-chain-algorand/blockchain'
import {
    useNativeAsset,
    useSingleAssetDetailsQuery,
} from '@perawallet/wallet-core-assets'
import {
    i18nKey,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    baseUnitsToDisplayUnits,
    decodeBytesToText,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { algorandTransactionIconName } from '@modules/algorand/icons'
import type {
    TransactionDetailAmount,
    TransactionDetailSummary,
} from '@modules/signing'

// Decimals an unresolved asset is read with, as the transfer rows always did.
const DEFAULT_ASSET_DECIMALS = 6

export const useAlgorandTransactionDetailLayout = (
    transaction: AlgorandTransactionView,
): TransactionDetailSummary => {
    const { t } = useLanguage()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const nativeAsset = useNativeAsset(scope)
    const assetTransfer = transaction.assetTransferTransaction
    const { data: transferAsset, isPending: isTransferAssetPending } =
        useSingleAssetDetailsQuery(
            assetTransfer?.assetId?.toString() ?? '',
            scope,
        )

    const txType = getTransactionType(transaction)
    const isOptIn =
        txType === 'asset-transfer' &&
        getAssetTransferType(transaction) === 'opt-in'

    return useMemo(() => {
        const payment = transaction.paymentTransaction
        let amount: Optional<TransactionDetailAmount>
        let to: Optional<string>
        let isAmountLoading = false
        if (txType === 'payment' && payment) {
            amount = {
                asset: nativeAsset,
                value: baseUnitsToDisplayUnits(
                    payment.amount ?? 0n,
                    nativeAsset.decimals,
                ),
            }
            to = payment.receiver
        } else if (txType === 'asset-transfer' && assetTransfer && !isOptIn) {
            to = assetTransfer.receiver
            if (transferAsset) {
                amount = {
                    asset: transferAsset,
                    value: baseUnitsToDisplayUnits(
                        assetTransfer.amount ?? 0n,
                        transferAsset.decimals ?? DEFAULT_ASSET_DECIMALS,
                    ),
                }
            } else {
                // The hero holds its place until the asset resolves, so the figure doesn't push the cards down.
                isAmountLoading = isTransferAssetPending
            }
        }

        return {
            scope,
            iconName: algorandTransactionIconName(txType),
            title: t(`transactions.type.${transaction.txType}`),
            // An inner transaction has a round but no id of its own.
            status:
                transaction.id || transaction.confirmedRound
                    ? 'completed'
                    : 'pending',
            amount,
            isAmountLoading,
            transactionId: transaction.id || undefined,
            timestamp: transaction.roundTimeMillis || undefined,
            block: transaction.confirmedRound
                ? {
                      labelKey: i18nKey('transactions.common.round'),
                      number: transaction.confirmedRound.toString(),
                  }
                : undefined,
            from: transaction.sender,
            to,
            fee: {
                asset: nativeAsset,
                value: baseUnitsToDisplayUnits(
                    transaction.fee ?? 0n,
                    nativeAsset.decimals,
                ),
            },
            note: decodeBytesToText(transaction.note) || undefined,
        }
    }, [
        transaction,
        txType,
        isOptIn,
        assetTransfer,
        transferAsset,
        isTransferAssetPending,
        nativeAsset,
        scope,
        t,
    ])
}
