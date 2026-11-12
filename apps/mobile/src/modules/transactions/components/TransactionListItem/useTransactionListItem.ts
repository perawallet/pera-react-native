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
import {
    chainAccountOf,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useAssetsQuery, useNativeAsset } from '@perawallet/wallet-core-assets'
import {
    i18nKey,
    type ChainScope,
    type LocalizedText,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import {
    isFeePaidByAccount,
    summarizeHistoryItem,
    type SuspectedPoisoning,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import type { IconName } from '@components/core'
import { chainNoticeOf, type ChainNoticeContent } from '@components/ChainNotice'
import { transactionIconName } from '@components/TransactionIcon'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import { useSuspectedPoisoningSheet } from '../../hooks/address-safety/useSuspectedPoisoningSheet'
import { useCounterpartyName } from '../../hooks/history/useCounterpartyName'
import { useOpenRecordDetails } from '../../hooks/history/useOpenRecordDetails'
import { useReplaceTransaction } from '../../hooks/history/useReplaceTransaction'
import { useSummaryTitle } from '../../hooks/history/useSummaryTitle'
import {
    MAX_VISIBLE_AMOUNTS,
    summaryAmountsOf,
    toAmountDisplay,
    type AmountDisplay,
} from './amounts'

const WAITING_ON_EARLIER = {
    key: i18nKey('transactions.notice.waiting_on_earlier'),
}
const FEE_LABEL = i18nKey('transactions.common.fee')
const MAX_FEE_LABEL = i18nKey('send_funds.fee.max_fee')

export type UseTransactionListItemParams = (
    | {
          transaction: TransactionHistoryItem
          scope: ChainScope
          onPress?: (transaction: TransactionHistoryItem) => void
      }
    // The details screen reads a cached history row, which a record has none of;
    // a pending one this wallet can re-price opens speed up and cancel instead.
    | { record: TransactionRecord }
) & { suspectedPoisoning?: SuspectedPoisoning }

export type UseTransactionListItemResult = {
    iconName: IconName
    title: string
    subtitle: Nullable<string>
    /** A counterparty name keeps both ends (an NFD suffix, an address); a summary subtitle reads from the start. */
    subtitleEllipsizeMode: 'middle' | 'tail'
    amounts: AmountDisplay[]
    /** Number of impacts hidden beyond {@link MAX_VISIBLE_AMOUNTS}, for "+N more". */
    amountsOverflowCount: number
    /** The network fee in the native asset, only for a row the account paid for that shows no other amount. */
    fee: Nullable<AmountDisplay>
    feeLabel: string
    /** Set when the chain flags a non-final status (pending, failed, replaced). */
    notice: Nullable<ChainNoticeContent>
    /** Opens the row's detail; a history item pressed without an `onPress` opens nothing, and long-press still copies. */
    handlePress: Optional<() => void>
    /** Long-press copies the transaction id (with the shared copied toast). */
    handleLongPress: () => void
    isSuspectedPoisoning: boolean
}

export const useTransactionListItem = (
    params: UseTransactionListItemParams,
): UseTransactionListItemResult => {
    const transaction = 'transaction' in params ? params.transaction : undefined
    const record = 'record' in params ? params.record : undefined
    const onPress = 'onPress' in params ? params.onPress : undefined
    const account = useSelectedAccount()
    const { copyToClipboard } = useClipboard()
    const { t } = useLanguage()
    const scope = 'record' in params ? params.record.scope : params.scope
    const address = account
        ? (chainAccountOf(account, scope.chainId)?.address ?? '')
        : ''
    const id = (record ?? transaction)?.id ?? ''

    const summary = useMemo(
        () =>
            record
                ? record.summary
                : summarizeHistoryItem(transaction!, address, scope.chainId),
        [record, transaction, address, scope.chainId],
    )

    const counterpartyName = useCounterpartyName(
        summary.subtitle ? '' : (summary.counterparty ?? ''),
        scope.chainId,
    )

    const render = useCallback(
        ({ key, params }: LocalizedText) => t(key, params),
        [t],
    )

    const title = useSummaryTitle(summary, scope)

    const subtitle = useMemo(() => {
        if (summary.subtitle) return render(summary.subtitle)
        return summary.counterparty ? counterpartyName : null
    }, [render, summary, counterpartyName])

    const { canReplace, isBlocked, handleReplace } =
        useReplaceTransaction(record)
    const notice = useMemo(
        () =>
            isBlocked
                ? chainNoticeOf({ kind: 'warning', title: WAITING_ON_EARLIER })
                : chainNoticeOf(summary.notice),
        [isBlocked, summary],
    )

    const allAmounts = useMemo(() => summaryAmountsOf(summary), [summary])
    const visibleAmounts = useMemo(
        () => allAmounts.slice(0, MAX_VISIBLE_AMOUNTS),
        [allAmounts],
    )
    const { data: storedAssets } = useAssetsQuery(
        scope,
        visibleAmounts.map(amount => amount.assetRef.assetId),
    )
    const amounts = useMemo(
        () =>
            visibleAmounts.map(amount =>
                toAmountDisplay(
                    amount,
                    storedAssets.get(amount.assetRef.assetId),
                ),
            ),
        [visibleAmounts, storedAssets],
    )

    const nativeAsset = useNativeAsset(scope)
    const fee = useMemo<Nullable<AmountDisplay>>(() => {
        if (!record?.fee || allAmounts.length > 0) return null
        if (!isFeePaidByAccount(record, address)) return null
        return toAmountDisplay(
            {
                assetRef: {
                    chainId: scope.chainId,
                    assetId: nativeAsset.assetId,
                },
                baseUnits: record.fee,
            },
            nativeAsset,
        )
    }, [record, allAmounts, address, scope.chainId, nativeAsset])

    const handleTransactionPress = useCallback(() => {
        if (transaction) onPress?.(transaction)
    }, [onPress, transaction])

    const { suspectedPoisoning } = params
    const { openSuspectedPoisoningSheet } = useSuspectedPoisoningSheet()
    const handleSuspectedRecordPress = useCallback(() => {
        if (suspectedPoisoning) {
            openSuspectedPoisoningSheet(suspectedPoisoning, scope)
        }
    }, [openSuspectedPoisoningSheet, suspectedPoisoning, scope])

    const handleRecordPress = useCallback(() => {
        void handleReplace()
    }, [handleReplace])
    const replacePress = canReplace ? handleRecordPress : undefined
    const { handleOpenDetails } = useOpenRecordDetails(record)
    const recordPress = suspectedPoisoning
        ? handleSuspectedRecordPress
        : (replacePress ?? handleOpenDetails)

    const handleLongPress = useCallback(
        () => void copyToClipboard(id),
        [copyToClipboard, id],
    )

    return {
        iconName: transactionIconName(summary.icon),
        title,
        subtitle,
        subtitleEllipsizeMode: summary.subtitle ? 'tail' : 'middle',
        amounts,
        amountsOverflowCount: Math.max(
            0,
            allAmounts.length - MAX_VISIBLE_AMOUNTS,
        ),
        fee,
        feeLabel: t(record?.isFeeMaximum ? MAX_FEE_LABEL : FEE_LABEL),
        notice,
        handlePress: record ? recordPress : handleTransactionPress,
        handleLongPress,
        isSuspectedPoisoning: !!suspectedPoisoning,
    }
}
