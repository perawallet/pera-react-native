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
} from '@perawallet/wallet-core-shared'

export type PortfolioTrendDirection = 'up' | 'down' | 'flat'

export type UsePortfolioTrendResult = {
    /** In the preferred currency. */
    trendAbsolute: Decimal
    trendPercentage: Decimal
    /** `flat` when the change rounds to zero at the 2 dp the trend renders at. */
    trendDirection: PortfolioTrendDirection
    hasNoTrend: boolean
    /** False once an offline read is paused: it won't resolve, so callers show nothing rather than a loader that never ends. */
    isPending: boolean
}

const directionOf = (change: Decimal): PortfolioTrendDirection => {
    if (change.toDecimalPlaces(2).isZero()) return 'flat'
    return change.isPositive() ? 'up' : 'down'
}

export const usePortfolioTrend = (
    sources: AccountHoldingSource[],
    period: HistoryPeriod,
    currencyScope: ChainScope,
    enabled: boolean,
): UsePortfolioTrendResult => {
    const { data, isPending, isPaused, isPartial } = usePortfolioHistoryQuery(
        sources,
        period,
        currencyScope,
        enabled,
    )
    const isSettling = isPending && !isPaused

    // Points with no preferred value have no rate behind them; keeping them
    // would let a `?? 0` fallback below invent a cliff from (or to) zero and
    // report a swing that never happened.
    const pricedValues = useMemo(
        () =>
            data.flatMap(point =>
                point.preferredValue ? [point.preferredValue] : [],
            ),
        [data],
    )

    const [trendAbsolute, trendPercentage] = useMemo(() => {
        const first = pricedValues.at(0) ?? new Decimal(0)
        const last = pricedValues.at(-1) ?? new Decimal(0)
        return [last.minus(first), percentChange(first, last)]
    }, [pricedValues])

    const trendDirection = directionOf(trendAbsolute)

    return {
        trendAbsolute,
        trendPercentage,
        trendDirection,
        // A failed or empty chain leaves no history, and the 0 it would
        // default to reads as a change the wallet never had. A chain the
        // chart left out would leave the change short of the total beside it.
        hasNoTrend: (!isSettling && pricedValues.length === 0) || isPartial,
        isPending: isSettling,
    }
}
