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
    TransactionFilter,
    type CustomDateRange,
} from '../TransactionsFilterContent'

/**
 * Helper to get start/end dates for filters
 */
export const getFilterTimes = (
    filter: TransactionFilter,
    customRange?: CustomDateRange,
): { afterTime?: string; beforeTime?: string } => {
    const now = new Date()
    const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
    )

    const toISODate = (d: Date) => d.toISOString().split('T')[0]

    switch (filter) {
        case TransactionFilter.Today: {
            return {
                afterTime: toISODate(startOfDay),
            }
        }
        case TransactionFilter.Yesterday: {
            const yesterdayStart = new Date(startOfDay)
            yesterdayStart.setDate(yesterdayStart.getDate() - 1)
            const yesterdayEnd = new Date(startOfDay)
            yesterdayEnd.setMilliseconds(-1) // End of yesterday

            return {
                afterTime: toISODate(yesterdayStart),
                beforeTime: toISODate(yesterdayEnd),
            }
        }
        case TransactionFilter.LastWeek: {
            const end = new Date(startOfDay)
            const start = new Date(startOfDay)
            start.setDate(start.getDate() - 7)

            return {
                afterTime: toISODate(start),
                beforeTime: toISODate(end),
            }
        }
        case TransactionFilter.LastMonth: {
            const startOfLastMonth = new Date(
                now.getFullYear(),
                now.getMonth() - 1,
                1,
            )
            const endOfLastMonth = new Date(
                now.getFullYear(),
                now.getMonth(),
                0,
                23,
                59,
                59,
            )

            return {
                afterTime: toISODate(startOfLastMonth),
                beforeTime: toISODate(endOfLastMonth),
            }
        }
        case TransactionFilter.CustomRange: {
            if (!customRange) return {}
            return {
                afterTime: toISODate(customRange.from),
                beforeTime: toISODate(customRange.to),
            }
        }
        case TransactionFilter.AllTime:
        default: {
            return {}
        }
    }
}
