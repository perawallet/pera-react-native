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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type {
    HistoryPeriod,
    Maybe,
    Nullable,
} from '@perawallet/wallet-core-shared'
import { USD_CURRENCY_ID } from '../constants'
import type { CurrencyHistoryPoint } from '../models'
import { nativeCurrencyFor } from './nativeCurrency'
import { useCurrency } from './useCurrency'
import { useCurrencyHistoryQuery } from './useCurrencyHistoryQuery'

const DAY_MS = 86_400_000

const utcDayOf = (date: Date): string => date.toISOString().slice(0, 10)

/**
 * Each UTC day from the first rate to the last, mapped to its rate. The
 * backend leaves out days it has no rate for, so a gap carries the day before
 * forward; days outside the range have no entry.
 */
const ratesByUtcDay = (
    points: CurrencyHistoryPoint[],
): Map<string, Decimal> => {
    const rates = new Map<string, Decimal>()
    const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day))
    sorted.forEach((point, index) => {
        const start = Date.parse(`${point.day}T00:00:00Z`)
        const next = sorted[index + 1]
        const end = next ? Date.parse(`${next.day}T00:00:00Z`) : start + 1
        for (let time = start; time < end; time += DAY_MS) {
            rates.set(utcDayOf(new Date(time)), point.usdPrice)
        }
    })
    return rates
}

export type UseHistoricUsdToPreferredResult = {
    /**
     * Converts a USD amount at `datetime` with the rate of its UTC day. A day
     * outside the fetched rates, or a fetch that failed, falls back to the
     * current rate (`useCurrency().usdToPreferred`).
     */
    usdToPreferredAt: (
        usdAmount: Maybe<Decimal>,
        datetime: Date,
    ) => Nullable<Decimal>
    /** The period's rates are on their way; converting now would draw today's rate first. */
    isPending: boolean
}

/**
 * USD → preferred currency for chart points over `period`. Only a fiat other
 * than USD has daily rates: USD needs no conversion, and the native asset's
 * rate keeps the current conversion.
 */
export const useHistoricUsdToPreferred = (
    scope: ChainScope,
    period: HistoryPeriod,
    enabled = true,
): UseHistoricUsdToPreferredResult => {
    const { preferredCurrency, usdToPreferred } = useCurrency(scope)
    const isFiatWithRates =
        preferredCurrency !== USD_CURRENCY_ID &&
        preferredCurrency !== nativeCurrencyFor(scope).symbol
    const { data: history, isLoading } = useCurrencyHistoryQuery(
        preferredCurrency,
        period,
        enabled && isFiatWithRates,
    )
    const rates = useMemo(
        () => (history ? ratesByUtcDay(history) : null),
        [history],
    )

    const usdToPreferredAt = useCallback(
        (usdAmount: Maybe<Decimal>, datetime: Date): Nullable<Decimal> => {
            const rate = rates?.get(utcDayOf(datetime))
            if (usdAmount == null || !rate) return usdToPreferred(usdAmount)
            return usdAmount.mul(rate)
        },
        [rates, usdToPreferred],
    )

    return { usdToPreferredAt, isPending: isLoading }
}
