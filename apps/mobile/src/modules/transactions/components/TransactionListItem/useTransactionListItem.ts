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
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import {
    baseUnitsToDisplayUnits,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import {
    useOpenSubmissionTxIdsQuery,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { formatNumber, type Nullable } from '@perawallet/wallet-core-shared'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import { useResolvedAddress } from '@hooks/useResolvedAddress'
import { getTransactionIconType } from './utils'
import { safeDecimals, type AmountDisplay } from './amounts'
import { useTransactionAmounts } from './useTransactionAmounts'

import type { TransactionIconType } from '@modules/transactions/components/TransactionIcon'

type TFunction = ReturnType<typeof useLanguage>['t']

export type UseTransactionListItemParams = {
    transaction: TransactionHistoryItem
    onPress?: (transaction: TransactionHistoryItem) => void
}

export type UseTransactionListItemResult = {
    iconType: TransactionIconType
    title: string
    subtitle: Nullable<string>
    amounts: AmountDisplay[]
    /** Number of impacts hidden beyond {@link MAX_VISIBLE_AMOUNTS}, for "+N more". */
    amountsOverflowCount: number
    /**
     * The transaction's id has an open submission-ledger row —
     * broadcast but not yet definitively resolved.
     */
    isPendingVerifying: boolean
    handlePress: () => void
    /** Long-press copies the transaction id (with the shared copied toast). */
    handleLongPress: () => void
}

/** Trailing zeros below this are trimmed, so whole amounts stay short. */
const MIN_FRACTION_DIGITS = 2

/**
 * A swap leg can be worth a fraction of a cent, which a flat 2-digit format
 * renders as a bare `0.00` — and now disagrees with the amount column beside
 * it. Show up to the asset's own precision instead, trimmed back to 2.
 */
const formatAmount = (baseUnits: Decimal, decimals: number): string => {
    const precision = safeDecimals(decimals)
    const displayAmount = baseUnitsToDisplayUnits(baseUnits, precision)
    const { sign, integer, fraction } = formatNumber(
        displayAmount,
        precision,
        undefined,
        MIN_FRACTION_DIGITS,
    )
    return `${sign}${integer}${fraction}`
}

/**
 * Gets the display title for a transaction.
 */
const getTitle = (
    tx: TransactionHistoryItem,
    userAddress: string,
    t: TFunction,
): string => {
    if (tx.interpretedMeaning?.title) {
        return tx.interpretedMeaning.title
    }

    if (tx.swapGroupDetail) return t('transactions.list_item.swap')

    const isOutgoing = tx.sender === userAddress
    const sendOrReceive = isOutgoing
        ? t('transactions.list_item.send')
        : t('transactions.list_item.receive')

    switch (tx.txType) {
        case 'pay': {
            return sendOrReceive
        }
        case 'axfer': {
            if (tx.closeTo) {
                return t('transactions.list_item.opt_out')
            }
            if (
                tx.sender === tx.receiver &&
                tx.amount !== null &&
                tx.amount.isZero()
            ) {
                return t('transactions.list_item.opt_in')
            }
            return sendOrReceive
        }
        case 'acfg': {
            return t('transactions.list_item.asset_config')
        }
        case 'afrz': {
            return t('transactions.list_item.asset_freeze')
        }
        case 'appl': {
            return t('transactions.list_item.app_call')
        }
        case 'keyreg': {
            return t('transactions.list_item.key_registration')
        }
        case 'hb': {
            return t('transactions.list_item.heartbeat')
        }
        case 'stpf': {
            return t('transactions.list_item.state_proof')
        }
        default: {
            return t('transactions.list_item.default')
        }
    }
}

/**
 * Hook that computes display values for a transaction list item.
 */
export const useTransactionListItem = ({
    transaction,
    onPress,
}: UseTransactionListItemParams): UseTransactionListItemResult => {
    const account = useSelectedAccount()
    const { copyToClipboard } = useClipboard()
    const { t } = useLanguage()
    const { network } = useNetwork()
    const { openTxIds } = useOpenSubmissionTxIdsQuery({ network })
    const userAddress = account?.address ?? ''
    const isPendingVerifying = openTxIds.has(transaction.id)

    const isOutgoing = useMemo(
        () => transaction.sender === userAddress,
        [transaction.sender, userAddress],
    )

    const counterpartyAddress = useMemo(() => {
        if (transaction.txType === 'pay' || transaction.txType === 'axfer') {
            return isOutgoing ? transaction.receiver : transaction.sender
        }
        return undefined
    }, [transaction, isOutgoing])

    const { displayName: counterpartyDisplayName } = useResolvedAddress(
        counterpartyAddress ?? '',
        { enabled: !!counterpartyAddress },
    )

    const iconType = useMemo(
        (): TransactionIconType =>
            getTransactionIconType(transaction, isOutgoing),
        [transaction, isOutgoing],
    )

    const title = useMemo(
        () => getTitle(transaction, userAddress, t),
        [transaction, userAddress, t],
    )

    const subtitle = useMemo(() => {
        // For swaps, show the exchange details
        if (transaction.swapGroupDetail) {
            const {
                amountIn,
                assetInDecimals,
                assetInUnitName,
                amountOut,
                assetOutDecimals,
                assetOutUnitName,
            } = transaction.swapGroupDetail

            const inAmount = formatAmount(amountIn, assetInDecimals)
            const outAmount = formatAmount(amountOut, assetOutDecimals)

            return `${inAmount} ${assetInUnitName} for ${outAmount} ${assetOutUnitName}`
        }

        // For app calls with inner transactions
        if (
            transaction.txType === 'appl' &&
            transaction.innerTransactionCount
        ) {
            return `${transaction.innerTransactionCount} inner txns`
        }

        // For payments and transfers, show the counterparty
        if (counterpartyAddress) {
            return counterpartyDisplayName
        }

        return null
    }, [transaction, counterpartyAddress, counterpartyDisplayName])

    const { amounts, amountsOverflowCount } = useTransactionAmounts(transaction)

    const handlePress = useCallback(() => {
        onPress?.(transaction)
    }, [onPress, transaction])

    const handleLongPress = useCallback(
        () => void copyToClipboard(transaction.id),
        [copyToClipboard, transaction.id],
    )

    return {
        iconType,
        title,
        subtitle,
        amounts,
        amountsOverflowCount,
        isPendingVerifying,
        handlePress,
        handleLongPress,
    }
}
