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
    chainAccountOf,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import {
    classifyDisplayableTransaction,
    getAssetTransferType,
    getTransactionType,
    type AlgorandTransactionKind,
    type AlgorandTransactionView,
} from '@perawallet/wallet-core-chain-algorand/blockchain'
import {
    useNativeAsset,
    useSingleAssetDetailsQuery,
} from '@perawallet/wallet-core-assets'
import {
    i18nKey,
    LEGACY_CHAIN_ID,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    baseUnitsToDisplayUnits,
    decodeBytesToText,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { algorandTransactionIconName } from '@modules/algorand/icons'
import {
    useTransactionHeroTitle,
    type TransactionDetailAmount,
    type TransactionDetailSummary,
} from '@modules/signing'

// Decimals an unresolved asset is read with, as the transfer rows always did.
const DEFAULT_ASSET_DECIMALS = 6

// Named as the history list names the row, so the hero matches what was tapped.
const TITLE_KEY_BY_KIND: Record<
    Exclude<
        AlgorandTransactionKind,
        'payment' | 'asset-transfer' | 'asset-clawback'
    >,
    I18nKey
> = {
    'asset-opt-in': i18nKey('transactions.list_item.opt_in'),
    'asset-opt-out': i18nKey('transactions.list_item.opt_out'),
    'asset-config': i18nKey('transactions.list_item.asset_config'),
    'asset-freeze': i18nKey('transactions.list_item.asset_freeze'),
    'key-registration': i18nKey('transactions.list_item.key_registration'),
    'app-call': i18nKey('transactions.list_item.app_call'),
    'state-proof': i18nKey('transactions.list_item.state_proof'),
    heartbeat: i18nKey('transactions.list_item.heartbeat'),
    unknown: i18nKey('transactions.list_item.default'),
}

// As history reads direction: a clawback debits its asset sender, and a
// self-transfer counts as received.
const titleKeyOf = (
    transaction: AlgorandTransactionView,
    viewer: string,
): I18nKey => {
    const kind = classifyDisplayableTransaction(transaction)
    if (
        kind !== 'payment' &&
        kind !== 'asset-transfer' &&
        kind !== 'asset-clawback'
    ) {
        return TITLE_KEY_BY_KIND[kind]
    }
    const receiver =
        transaction.paymentTransaction?.receiver ??
        transaction.assetTransferTransaction?.receiver
    const debited =
        transaction.assetTransferTransaction?.sender ?? transaction.sender
    const isOut =
        debited === viewer ||
        (transaction.sender === viewer && receiver !== viewer)
    return isOut
        ? i18nKey('transactions.list_item.send')
        : i18nKey('transactions.list_item.receive')
}

export const useAlgorandTransactionDetailLayout = (
    transaction: AlgorandTransactionView,
): TransactionDetailSummary => {
    const heroTitle = useTransactionHeroTitle()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const account = useSelectedAccount()
    const viewer = account
        ? (chainAccountOf(account, scope.chainId)?.address ?? '')
        : ''
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

        // An inner transaction has a round but no id of its own.
        const isOnChain = !!transaction.id || !!transaction.confirmedRound
        // Only the sender pays the fee; one still to be signed shows it whoever is viewing.
        const isFeeShown = !isOnChain || transaction.sender === viewer

        return {
            scope,
            iconName: algorandTransactionIconName(txType),
            title: heroTitle({ key: titleKeyOf(transaction, viewer) }),
            status: isOnChain ? 'completed' : 'pending',
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
            fee: isFeeShown
                ? {
                      asset: nativeAsset,
                      value: baseUnitsToDisplayUnits(
                          transaction.fee ?? 0n,
                          nativeAsset.decimals,
                      ),
                  }
                : undefined,
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
        viewer,
        heroTitle,
    ])
}
