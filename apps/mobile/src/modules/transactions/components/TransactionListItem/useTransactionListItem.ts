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
    canHideHolding,
    chainAccountOf,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import {
    PeraAssetVerificationTier,
    useAssetsQuery,
    useNativeAsset,
} from '@perawallet/wallet-core-assets'
import { imitatedCurrencyOf } from '@perawallet/wallet-core-currencies'
import {
    i18nKey,
    type ChainScope,
    type LocalizedText,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import {
    isFeePaidByAccount,
    isSentByOtherSigner,
    recordSignerOf,
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
const NOT_SENT_BY_YOU = i18nKey('transactions.list_item.not_sent_by_you')
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

/** A visible amount, flagged when its token is one Pera calls suspicious on a chain that receives tokens unasked. */
export type RowAmount = AmountDisplay & {
    isSuspicious: boolean
    /** Drawn grey and unsigned: a scam token, or an entry of a suspected-poisoning row, is no real movement of value. */
    isMuted: boolean
}

export type UseTransactionListItemResult = {
    iconName: IconName
    title: string
    subtitle: Nullable<string>
    subtitleEllipsizeMode: 'middle' | 'tail'
    amounts: RowAmount[]
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
    /** A visible amount moves a token Pera flags suspicious on a chain that receives tokens unasked. */
    isSuspiciousToken: boolean
    /** Code imitated by the first visible amount whose unit name passes itself off as a currency (its chain's native ticker or a fiat code), or null. */
    imitatedCurrency: Nullable<string>
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
    const { suspectedPoisoning } = params

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

    const summaryTitle = useSummaryTitle(summary, scope)
    // Detection flags an outgoing entry only when the history never shows the account signing it.
    const isNotSentByYou =
        (!!suspectedPoisoning && summary.direction === 'out') ||
        isSentByOtherSigner({
            summary,
            signer: record
                ? recordSignerOf(record, address)
                : transaction?.sender,
            isSignedElsewhere: record?.isSignedElsewhere,
            accountAddress: address,
            chainId: scope.chainId,
        })
    const title = isNotSentByYou ? t(NOT_SENT_BY_YOU) : summaryTitle

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
            visibleAmounts.map((amount): RowAmount => {
                const { assetId, chainId } = amount.assetRef
                const stored = storedAssets.get(assetId)
                const isSuspicious =
                    stored?.peraMetadata?.verificationTier ===
                        PeraAssetVerificationTier.suspicious &&
                    canHideHolding(chainId, assetId)
                const display = toAmountDisplay(amount, stored)
                return {
                    ...display,
                    prefix: suspectedPoisoning ? undefined : display.prefix,
                    isSuspicious,
                    isMuted: isSuspicious || !!suspectedPoisoning,
                }
            }),
        [visibleAmounts, storedAssets, suspectedPoisoning],
    )

    const isSuspiciousToken = amounts.some(amount => amount.isSuspicious)

    const imitatedCurrency = useMemo<Nullable<string>>(() => {
        for (const a of amounts) {
            const code = imitatedCurrencyOf(
                { chainId: a.chainId, assetId: a.assetId },
                a.currency,
            )
            if (code !== null) return code
        }
        return null
    }, [amounts])

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

    const handleRecordPress = useCallback(() => {
        void handleReplace()
    }, [handleReplace])
    const replacePress = canReplace ? handleRecordPress : undefined
    const { handleOpenDetails } = useOpenRecordDetails(
        record,
        suspectedPoisoning,
    )
    const recordPress = suspectedPoisoning
        ? handleOpenDetails
        : (replacePress ?? handleOpenDetails)

    const handleLongPress = useCallback(
        () => void copyToClipboard(id),
        [copyToClipboard, id],
    )

    return {
        iconName: transactionIconName(summary.icon),
        title,
        subtitle,
        subtitleEllipsizeMode: summary.subtitleEllipsis ?? 'middle',
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
        isSuspiciousToken,
        imitatedCurrency,
    }
}
