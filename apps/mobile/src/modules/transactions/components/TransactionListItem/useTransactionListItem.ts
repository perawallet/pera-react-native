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
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import {
    LEGACY_CHAIN_ID,
    type LocalizedText,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
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
import { useReplaceTransaction } from '../../hooks/history/useReplaceTransaction'
import {
    MAX_VISIBLE_AMOUNTS,
    summaryAmountsOf,
    toAmountDisplay,
    type AmountDisplay,
} from './amounts'

export type UseTransactionListItemParams = (
    | {
          transaction: TransactionHistoryItem
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
    amounts: AmountDisplay[]
    /** Number of impacts hidden beyond {@link MAX_VISIBLE_AMOUNTS}, for "+N more". */
    amountsOverflowCount: number
    /** Set when the chain flags a non-final status (pending, failed, replaced). */
    notice: Nullable<ChainNoticeContent>
    /** Unset on a row that opens nothing; long-press still copies, so the row stays touchable. */
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
    const selectedScope = useSelectedScope(LEGACY_CHAIN_ID)
    const scope = record?.scope ?? selectedScope
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

    const title = useMemo(() => render(summary.title), [render, summary])

    const subtitle = useMemo(() => {
        if (summary.subtitle) return render(summary.subtitle)
        return summary.counterparty ? counterpartyName : null
    }, [render, summary, counterpartyName])

    const notice = useMemo(() => chainNoticeOf(summary.notice), [summary])

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

    const { canReplace, handleReplace } = useReplaceTransaction(record)
    const handleRecordPress = useCallback(() => {
        void handleReplace()
    }, [handleReplace])
    const replacePress = canReplace ? handleRecordPress : undefined
    const recordPress = suspectedPoisoning
        ? handleSuspectedRecordPress
        : replacePress

    const handleLongPress = useCallback(
        () => void copyToClipboard(id),
        [copyToClipboard, id],
    )

    return {
        iconName: transactionIconName(summary.icon),
        title,
        subtitle,
        amounts,
        amountsOverflowCount: Math.max(
            0,
            allAmounts.length - MAX_VISIBLE_AMOUNTS,
        ),
        notice,
        handlePress: record ? recordPress : handleTransactionPress,
        handleLongPress,
        isSuspectedPoisoning: !!suspectedPoisoning,
    }
}
