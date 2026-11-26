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
import type { Decimal } from 'decimal.js'
import {
    chainAccountOf,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useAssetsQuery, useNativeAsset } from '@perawallet/wallet-core-assets'
import {
    i18nKey,
    type ChainId,
    type ChainScope,
    type LocalizedText,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import {
    isFeePaidByAccount,
    recordSignerOf,
    summarizeHistoryItem,
    type SuspectedPoisoning,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import type { IconName } from '@components/core'
import { chainNoticeOf, type ChainNoticeContent } from '@components/ChainNotice'
import { useInfoButton } from '@components/InfoButton'
import type { LeadingAsset } from '@components/TransactionLeadingIcon'
import { usePreferredAmount } from '@components/PreferredAmount'
import { transactionIconName } from '@components/TransactionIcon'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import { useCounterpartyName } from '../../hooks/history/useCounterpartyName'
import { useOpenRecordDetails } from '../../hooks/history/useOpenRecordDetails'
import { useReplaceTransaction } from '../../hooks/history/useReplaceTransaction'
import { useResolvedSummaryTitle } from '../../hooks/history/useSummaryTitle'
import {
    assessHistoryEntry,
    suspicionCopyOf,
} from '../../utils/historySuspicion'
import { leadingAssetsOf, swapChainIdsOf } from '../../utils/leadingAssets'
import {
    MAX_VISIBLE_AMOUNTS,
    summaryAmountsOf,
    visibleAssetIdsOf,
} from '../../utils/summaryAmounts'
import { toAmountDisplay, type AmountDisplay } from './amounts'

const WAITING_ON_EARLIER = {
    key: i18nKey('transactions.notice.waiting_on_earlier'),
}
const SWAP = i18nKey('transactions.list_item.swap')
const SWAP_ASSETS = i18nKey('transactions.list_item.swap_assets')
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

export type RowAmount = AmountDisplay & {
    /** Drawn grey: a flagged token, or an entry that moved no real value. */
    isMuted: boolean
}

export type UseTransactionListItemResult = {
    iconName: IconName
    title: string
    subtitle: Nullable<string>
    subtitleEllipsizeMode: 'middle' | 'tail'
    amounts: RowAmount[]
    /** The single visible amount in the preferred currency; null with several amounts, a muted one, or no stored price. */
    fiatValue: Nullable<Decimal>
    /** Number of impacts hidden beyond {@link MAX_VISIBLE_AMOUNTS}, for "+N more". */
    amountsOverflowCount: number
    /** The network fee in the native asset, only for a non-approval row the account paid for that shows no other amount. */
    fee: Nullable<AmountDisplay>
    feeLabel: string
    /** Not yet final: the row shows the pending badge in place of a notice. */
    isPending: boolean
    /** Set when the chain flags a status the pending badge doesn't cover (failed, replaced, waiting on an earlier send). */
    notice: Nullable<ChainNoticeContent>
    /** Opens the row's detail; a history item pressed without an `onPress` opens nothing, and long-press still copies. */
    handlePress: Optional<() => void>
    /** Long-press copies the transaction id (with the shared copied toast). */
    handleLongPress: () => void
    /** Poisoning, a look-alike or forged transfer, or a flagged token: the row is muted and carries a badge. */
    isSuspicious: boolean
    /** Why the row is suspicious, as the sheet it opens is titled; null on an ordinary row. */
    suspicionTitle: Nullable<string>
    /** Opens the sheet explaining why the row is suspicious. */
    handleSuspiciousPress: () => void
    /** The networks the icon leads with when no asset does: a cross-chain swap's, else the row's own. */
    leadingChainIds: ChainId[]
    /** The asset a send or receive moved, or a swap's from and to assets; empty for any other row. */
    leadingAssets: LeadingAsset[]
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

    const resolvedTitle = useResolvedSummaryTitle(summary, scope)
    const isSwap = summary.kind === 'swap'

    // A swap's second line names its pair; the provider belongs on the detail screen.
    const counterpartySubtitle = useMemo(() => {
        if (isSwap) {
            const { from, to } = resolvedTitle.params ?? {}
            return from && to ? t(SWAP_ASSETS, { from, to }) : null
        }
        if (summary.subtitle) return render(summary.subtitle)
        return summary.counterparty ? counterpartyName : null
    }, [isSwap, resolvedTitle, t, render, summary, counterpartyName])

    const { canReplace, isBlocked, handleReplace } =
        useReplaceTransaction(record)
    // A send stuck behind an earlier one says so instead of the pending badge.
    const isPending =
        !isBlocked && (record ?? transaction)?.status === 'pending'
    const notice = useMemo(() => {
        if (isBlocked) {
            return chainNoticeOf({ kind: 'warning', title: WAITING_ON_EARLIER })
        }
        return isPending ? null : chainNoticeOf(summary.notice)
    }, [isBlocked, isPending, summary])

    const allAmounts = useMemo(() => summaryAmountsOf(summary), [summary])
    const visibleAmounts = useMemo(
        () => allAmounts.slice(0, MAX_VISIBLE_AMOUNTS),
        [allAmounts],
    )
    const heroAssetIds = useMemo(() => visibleAssetIdsOf(summary), [summary])
    const { data: storedAssets } = useAssetsQuery(scope, heroAssetIds)
    const assessment = useMemo(
        () =>
            assessHistoryEntry({
                summary,
                signer: record
                    ? recordSignerOf(record, address)
                    : transaction?.sender,
                isSignedElsewhere: record?.isSignedElsewhere,
                accountAddress: address,
                chainId: scope.chainId,
                isSuspectedPoisoning: !!suspectedPoisoning,
                storedAssets,
            }),
        [
            summary,
            record,
            transaction,
            address,
            scope.chainId,
            suspectedPoisoning,
            storedAssets,
        ],
    )
    const { suspicion, isApprovedSend, isMovingNothing, flaggedAssetIds } =
        assessment
    // The signer of an allowance spend is who spent it; a row known only from a
    // transfer log names none, so it keeps the recipient.
    const spenderName = useCounterpartyName(
        isApprovedSend ? (record?.initiator ?? '') : '',
        scope.chainId,
    )
    const amounts = useMemo(
        () =>
            visibleAmounts.map((amount): RowAmount => {
                const { assetId } = amount.assetRef
                const display = toAmountDisplay(
                    amount,
                    storedAssets.get(assetId),
                )
                return {
                    ...display,
                    prefix: isMovingNothing ? undefined : display.prefix,
                    isMuted: isMovingNothing || flaggedAssetIds.has(assetId),
                }
            }),
        [visibleAmounts, storedAssets, isMovingNothing, flaggedAssetIds],
    )

    // From the synced price store only: an asset with no stored price shows no line.
    const fiatSource =
        allAmounts.length === 1 && !amounts[0]?.isMuted ? amounts[0] : undefined
    const { convertedValue: fiatValue } = usePreferredAmount(
        fiatSource?.value,
        fiatSource?.assetId ?? '',
        undefined,
        undefined,
        scope,
    )
    const suspicionCopy = suspicion ? suspicionCopyOf(suspicion) : undefined
    const suspicionTitle = suspicionCopy ? render(suspicionCopy.title) : null
    const { openInfo: handleSuspiciousPress } = useInfoButton({
        title: suspicionTitle ?? undefined,
        children: suspicionCopy && render(suspicionCopy.body),
    })

    const defaultTitle = isSwap ? { key: SWAP } : resolvedTitle
    const title = render(
        assessment.titleKey ? { key: assessment.titleKey } : defaultTitle,
    )
    const subtitle =
        isApprovedSend && record?.initiator ? spenderName : counterpartySubtitle

    const leadingAssets = useMemo(
        () => leadingAssetsOf(summary, storedAssets),
        [summary, storedAssets],
    )

    const leadingChainIds = useMemo(() => {
        const swapChainIds = swapChainIdsOf(summary)
        return swapChainIds.length > 1 ? swapChainIds : [scope.chainId]
    }, [summary, scope.chainId])

    const nativeAsset = useNativeAsset(scope)
    const isApproval = summary.kind === 'approval'
    const fee = useMemo<Nullable<AmountDisplay>>(() => {
        if (!record?.fee || allAmounts.length > 0 || isApproval) return null
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
    }, [record, allAmounts, isApproval, address, scope.chainId, nativeAsset])

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
        fiatValue: fiatSource ? fiatValue : null,
        amountsOverflowCount: Math.max(
            0,
            allAmounts.length - MAX_VISIBLE_AMOUNTS,
        ),
        fee,
        feeLabel: t(record?.isFeeMaximum ? MAX_FEE_LABEL : FEE_LABEL),
        isPending,
        notice,
        handlePress: record ? recordPress : handleTransactionPress,
        handleLongPress,
        isSuspicious: suspicion !== null,
        suspicionTitle,
        handleSuspiciousPress,
        leadingChainIds,
        leadingAssets,
    }
}
