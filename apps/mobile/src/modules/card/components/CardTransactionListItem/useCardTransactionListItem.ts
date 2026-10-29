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
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
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

const KIND_LABEL_KEYS: Record<CardTransactionKind, I18nKey> = {
    [CardTransactionKind.Payment]: i18nKey(
        'peraCard.transactions.kind_payment',
    ),
    [CardTransactionKind.Refund]: i18nKey('peraCard.transactions.kind_refund'),
    [CardTransactionKind.Deposit]: i18nKey(
        'peraCard.transactions.kind_deposit',
    ),
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

const STATUS_LABEL_KEYS: Partial<Record<TransactionStatus, I18nKey>> = {
    [TransactionStatus.Declined]: i18nKey(
        'peraCard.transactions.status_declined',
    ),
    [TransactionStatus.Reverted]: i18nKey(
        'peraCard.transactions.status_reverted',
    ),
}

const FALLBACK_STATUS_LABEL_KEY: I18nKey = i18nKey(
    'peraCard.transactions.status_pending',
)

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
            : t(
                  STATUS_LABEL_KEYS[transaction.status] ??
                      FALLBACK_STATUS_LABEL_KEY,
              )

    // A deposit's title already says "Deposit", so the row drops the prefix.
    const segments =
        kind === CardTransactionKind.Deposit
            ? [secondSegment]
            : [t(KIND_LABEL_KEYS[kind]), secondSegment]

    return { title, subtitle: segments.filter(Boolean).join(' • '), isDebit }
}
