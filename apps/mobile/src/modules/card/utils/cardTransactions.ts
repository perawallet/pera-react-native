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
} from '@perawallet/wallet-core-card'

export type CardTransactionSection = {
    /** Stable `YYYY-MM` key for the month. */
    key: string
    /** Display title, e.g. "July". */
    title: string
    data: CardTransaction[]
}

// Month names come from `Intl` (the same `en-US` convention as `formatDisplayDate`
// in shared) rather than a hand-maintained English list. UTC keeps the grouping
// and labels timezone-stable.
const longMonthFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    timeZone: 'UTC',
})
const shortMonthFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
})
const longDateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
})
const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
})

// Section key for transactions whose dateTime is missing/unparseable, so a
// malformed row can't crash `Intl.format` (which throws on an Invalid Date).
const UNKNOWN_MONTH_KEY = 'unknown'

const parseDateTime = (dateTime: string): Date | null => {
    const date = new Date(dateTime)
    return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Groups card transactions into month sections, newest month first and newest
 * transaction first within each. Uses UTC so grouping is timezone-stable.
 */
export const groupCardTransactionsByMonth = (
    transactions: CardTransaction[],
): CardTransactionSection[] => {
    const sorted = [...transactions].sort((a, b) =>
        b.dateTime.localeCompare(a.dateTime),
    )

    const sections: CardTransactionSection[] = []
    const indexByKey = new Map<string, number>()

    for (const transaction of sorted) {
        const date = parseDateTime(transaction.dateTime)
        const key = date
            ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
            : UNKNOWN_MONTH_KEY

        const existing = indexByKey.get(key)
        if (existing === undefined) {
            indexByKey.set(key, sections.length)
            sections.push({
                key,
                title: date ? longMonthFormatter.format(date) : '',
                data: [transaction],
            })
        } else {
            sections[existing].data.push(transaction)
        }
    }

    return sections
}

/** Short, timezone-stable transaction date, e.g. "12 Jul". Empty when unparseable. */
export const formatCardTransactionDate = (dateTime: string): string => {
    const date = parseDateTime(dateTime)
    return date
        ? `${date.getUTCDate()} ${shortMonthFormatter.format(date)}`
        : ''
}

/**
 * Full timezone-stable date-time, e.g. "Dec 24, 2024 at 01:10 PM". Empty when
 * unparseable.
 */
export const formatCardTransactionDateTime = (dateTime: string): string => {
    const date = parseDateTime(dateTime)
    return date
        ? `${longDateFormatter.format(date)} at ${timeFormatter.format(date)}`
        : ''
}

/**
 * What a row is, derived from sign + merchant (Baanx has no explicit type):
 * a debit is a "payment", a credit with a merchant is a "refund", a credit
 * without one is a "deposit". Status (declined/pending) is shown separately.
 */
export const CardTransactionKind = {
    Payment: 'payment',
    Refund: 'refund',
    Deposit: 'deposit',
} as const
export type CardTransactionKind =
    (typeof CardTransactionKind)[keyof typeof CardTransactionKind]

export const getCardTransactionKind = (
    transaction: CardTransaction,
): CardTransactionKind => {
    if (transaction.sign === TransactionSign.Debit) {
        return CardTransactionKind.Payment
    }
    // Trim so an empty/whitespace merchant counts as "no merchant" (deposit).
    return transaction.merchantName?.trim()
        ? CardTransactionKind.Refund
        : CardTransactionKind.Deposit
}

/**
 * Friendly-label i18n keys for Baanx `merchantType`. The wire values are an
 * OPEN set (the api-reference only shows examples: "OutOfWalletOnline",
 * "InStore", "InStoreWithPin", "ATM"), so unknown values return undefined and
 * the caller falls back to the raw string.
 */
// Map (not object literal): an open-set wire value like "Constructor" must
// miss, not resolve through Object.prototype.
const MERCHANT_TYPE_LABEL_KEYS = new Map<string, string>([
    ['instore', 'peraCard.transactions.merchant_type_in_store'],
    ['instorewithpin', 'peraCard.transactions.merchant_type_in_store_with_pin'],
    ['outofwalletonline', 'peraCard.transactions.merchant_type_online'],
    ['atm', 'peraCard.transactions.merchant_type_atm'],
])

export const getCardMerchantTypeLabelKey = (
    merchantType: string,
): string | undefined =>
    MERCHANT_TYPE_LABEL_KEYS.get(merchantType.toLowerCase())

/**
 * Friendly-label i18n keys for Baanx `mccCategory` — a documented closed enum
 * (SUBSCRIPTIONS, FOOD, TRAVEL, ENTERTAINMENT, HEALTH, ATM, UTILITIES, MISC).
 * Still tolerant: unknown values return undefined so the raw string shows.
 */
const MCC_CATEGORY_LABEL_KEYS = new Map<string, string>([
    ['SUBSCRIPTIONS', 'peraCard.transactions.mcc_category_subscriptions'],
    ['FOOD', 'peraCard.transactions.mcc_category_food'],
    ['TRAVEL', 'peraCard.transactions.mcc_category_travel'],
    ['ENTERTAINMENT', 'peraCard.transactions.mcc_category_entertainment'],
    ['HEALTH', 'peraCard.transactions.mcc_category_health'],
    ['ATM', 'peraCard.transactions.mcc_category_atm'],
    ['UTILITIES', 'peraCard.transactions.mcc_category_utilities'],
    ['MISC', 'peraCard.transactions.mcc_category_misc'],
])

export const getCardMccCategoryLabelKey = (
    mccCategory: string,
): string | undefined => MCC_CATEGORY_LABEL_KEYS.get(mccCategory.toUpperCase())

/** Relative date as a translatable descriptor; the row maps it to copy. */
export type CardTransactionRelativeDate =
    | { kind: 'today' }
    | { kind: 'yesterday' }
    | { kind: 'daysAgo'; days: number }
    | { kind: 'date'; label: string }

const MS_PER_DAY = 24 * 60 * 60 * 1000
// Beyond this many days we show an absolute short date instead of "N days ago".
const RELATIVE_DAY_LIMIT = 30

// UTC day index so "Today"/"Yesterday" align with the UTC month grouping.
const toUtcDayIndex = (epochMs: number): number =>
    Math.floor(epochMs / MS_PER_DAY)

export const getCardTransactionRelativeDate = (
    dateTime: string,
    now: number = Date.now(),
): CardTransactionRelativeDate => {
    const date = parseDateTime(dateTime)
    if (!date) return { kind: 'date', label: '' }

    const days = toUtcDayIndex(now) - toUtcDayIndex(date.getTime())
    if (days <= 0) return { kind: 'today' }
    if (days === 1) return { kind: 'yesterday' }
    if (days < RELATIVE_DAY_LIMIT) return { kind: 'daysAgo', days }
    return { kind: 'date', label: formatCardTransactionDate(dateTime) }
}
