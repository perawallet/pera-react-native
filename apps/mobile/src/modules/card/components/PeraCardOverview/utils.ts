/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { type CardTransaction } from '@perawallet/wallet-core-card'

export type CardTransactionSection = {
    /** Stable `YYYY-MM` key for the month. */
    key: string
    /** Display title, e.g. "July". */
    title: string
    data: CardTransaction[]
}

const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
]

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
        const date = new Date(transaction.dateTime)
        const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

        const existing = indexByKey.get(key)
        if (existing === undefined) {
            indexByKey.set(key, sections.length)
            sections.push({
                key,
                title: MONTH_NAMES[date.getUTCMonth()],
                data: [transaction],
            })
        } else {
            sections[existing].data.push(transaction)
        }
    }

    return sections
}

/** Short, timezone-stable transaction date, e.g. "12 Jul". */
export const formatCardTransactionDate = (dateTime: string): string => {
    const date = new Date(dateTime)
    const month = MONTH_NAMES[date.getUTCMonth()].slice(0, 3)
    return `${date.getUTCDate()} ${month}`
}
