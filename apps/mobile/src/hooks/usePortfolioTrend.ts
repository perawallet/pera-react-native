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

import { useMemo } from 'react'
import { Decimal } from 'decimal.js'
import {
    type AccountHoldingSource,
    usePortfolioHistoryQuery,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    percentChange,
    type HistoryPeriod,
    type Maybe,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { LIST_MAX_PRECISION } from '@components/CurrencyAmount'

export type PortfolioTrendDirection = 'up' | 'down' | 'flat'

/** `amount` trends a holding's display-unit amount rather than its preferred-currency value. */
export type TrendMeasure = 'value' | 'amount'

// The places each measure renders at: the trend's fiat, and an asset list row's amount.
const PLACES_BY_MEASURE: Record<TrendMeasure, number> = {
    value: 2,
    amount: LIST_MAX_PRECISION,
}

export type UsePortfolioTrendResult = {
    /** In the preferred currency, or display units when trending an amount. */
    trendAbsolute: Decimal
    trendPercentage: Decimal
    /** `flat` when the change rounds to zero at the places the trend renders at. */
    trendDirection: PortfolioTrendDirection
    hasNoTrend: boolean
    /** False once an offline read is paused: it won't resolve, so callers show nothing rather than a loader that never ends. */
    isPending: boolean
}

const directionOf = (
    change: Decimal,
    places: number,
): PortfolioTrendDirection => {
    if (change.toDecimalPlaces(places).isZero()) return 'flat'
    return change.isPositive() ? 'up' : 'down'
}

type TrendHistory = {
    data: { preferredValue: Nullable<Decimal>; amount?: Decimal }[]
    isPending: boolean
    isPaused: boolean
    isError: boolean
}

/**
 * `isIncomplete` withholds a change the history can't fully back.
 * `selectedValue` is a scrubbed point's value: the change then runs from the
 * chart's start to it, and `null` (an unpriced point) has none. In `amount`
 * mode it is the scrubbed point's amount.
 */
export const useHistoryTrend = (
    { data, isPending, isPaused, isError }: TrendHistory,
    isIncomplete: boolean,
    selectedValue?: Maybe<Decimal>,
    measure: TrendMeasure = 'value',
): UsePortfolioTrendResult => {
    const isSettling = isPending && !isPaused

    // Points with no preferred value have no rate behind them; keeping them
    // would let a `?? 0` fallback below invent a cliff from (or to) zero and
    // report a swing that never happened.
    const pricedValues = useMemo(
        () =>
            data.flatMap(point => {
                const value =
                    measure === 'amount' ? point.amount : point.preferredValue
                return value ? [value] : []
            }),
        [data, measure],
    )

    const [trendAbsolute, trendPercentage] = useMemo(() => {
        const first = pricedValues.at(0) ?? new Decimal(0)
        const last = selectedValue ?? pricedValues.at(-1) ?? new Decimal(0)
        return [last.minus(first), percentChange(first, last)]
    }, [pricedValues, selectedValue])

    const trendDirection = directionOf(
        trendAbsolute,
        PLACES_BY_MEASURE[measure],
    )

    return {
        trendAbsolute,
        trendPercentage,
        trendDirection,
        // Failed, paused or unpriced points leave nothing to measure, and the
        // 0 they'd default to reads as a change the wallet never had; a loaded
        // history with no points is a real flat 0. A chain the chart left out
        // would leave the change short of the total beside it.
        hasNoTrend:
            (!isSettling &&
                pricedValues.length === 0 &&
                (data.length > 0 || isError || isPaused)) ||
            selectedValue === null ||
            isIncomplete,
        isPending: isSettling,
    }
}

export const usePortfolioTrend = (
    sources: AccountHoldingSource[],
    period: HistoryPeriod,
    currencyScope: ChainScope,
    enabled: boolean,
    selectedValue?: Maybe<Decimal>,
): UsePortfolioTrendResult => {
    const history = usePortfolioHistoryQuery(
        sources,
        period,
        currencyScope,
        enabled,
    )
    return useHistoryTrend(
        history,
        history.isPartial || history.isUnavailableOnNetwork,
        selectedValue,
    )
}
