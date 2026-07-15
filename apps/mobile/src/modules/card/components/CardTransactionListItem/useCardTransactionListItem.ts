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

import {
    type CardTransaction,
    TransactionSign,
    TransactionStatus,
} from '@perawallet/wallet-core-card'
import { useLanguage } from '@hooks/useLanguage'
import {
    CardTransactionKind,
    getCardTransactionKind,
    getCardTransactionRelativeDate,
    type CardTransactionRelativeDate,
} from '../../utils/cardTransactions'

type Translate = (key: string, options?: Record<string, unknown>) => string

type UseCardTransactionListItemResult = {
    title: string
    /** e.g. "Payment • Today", "Refund • Pending", "Today" (deposit). */
    subtitle: string
    isDebit: boolean
}

const kindLabel = (t: Translate, kind: CardTransactionKind): string => {
    switch (kind) {
        case CardTransactionKind.Payment: {
            return t('peraCard.transactions.kind_payment')
        }
        case CardTransactionKind.Refund: {
            return t('peraCard.transactions.kind_refund')
        }
        case CardTransactionKind.Deposit: {
            return t('peraCard.transactions.kind_deposit')
        }
    }
}

const relativeDateLabel = (
    t: Translate,
    relative: CardTransactionRelativeDate,
): string => {
    switch (relative.kind) {
        case 'today': {
            return t('peraCard.transactions.today')
        }
        case 'yesterday': {
            return t('peraCard.transactions.yesterday')
        }
        case 'daysAgo': {
            return t('peraCard.transactions.days_ago', { days: relative.days })
        }
        case 'date': {
            return relative.label
        }
    }
}

const statusLabel = (t: Translate, status: TransactionStatus): string => {
    switch (status) {
        case TransactionStatus.Declined: {
            return t('peraCard.transactions.status_declined')
        }
        case TransactionStatus.Reverted: {
            return t('peraCard.transactions.status_reverted')
        }
        default: {
            return t('peraCard.transactions.status_pending')
        }
    }
}

export const useCardTransactionListItem = (
    transaction: CardTransaction,
): UseCardTransactionListItemResult => {
    const { t } = useLanguage()

    const kind = getCardTransactionKind(transaction)
    const isDebit = transaction.sign === TransactionSign.Debit

    // `||` (not `??`) so an empty/whitespace merchant name falls back too.
    const merchantName = transaction.merchantName?.trim()
    const title =
        kind === CardTransactionKind.Deposit
            ? t('peraCard.transactions.kind_deposit')
            : merchantName || t('peraCard.account.transaction_fallback')

    // Confirmed rows show when it happened; otherwise the status is the news.
    const secondSegment =
        transaction.status === TransactionStatus.Confirmed
            ? relativeDateLabel(
                  t,
                  getCardTransactionRelativeDate(transaction.dateTime),
              )
            : statusLabel(t, transaction.status)

    // A deposit's title already says "Deposit", so the row drops the prefix.
    const segments =
        kind === CardTransactionKind.Deposit
            ? [secondSegment]
            : [kindLabel(t, kind), secondSegment]

    return { title, subtitle: segments.filter(Boolean).join(' • '), isDebit }
}
