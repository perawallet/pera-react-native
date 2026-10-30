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

import { PWView } from '@components/core'
import { useStyles } from './styles'
import {
    percentChange,
    type HistoryPeriod,
} from '@perawallet/wallet-core-shared'
import { useMemo } from 'react'
import { Decimal } from 'decimal.js'
import { useSettings } from '@perawallet/wallet-core-settings'
import {
    type AccountHoldingSource,
    usePortfolioHistoryQuery,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PreferredAmount } from '@components/PreferredAmount'
import { TrendIndicator } from '@components/TrendIndicator'

export type WealthTrendProps = {
    /** Trended as one summed series. */
    sources: AccountHoldingSource[]
    currencyScope: ChainScope
    period: HistoryPeriod
    /** Gate the (slow) history fetch on chart visibility. */
    enabled?: boolean
}

export const WealthTrend = ({
    sources,
    currencyScope,
    period,
    enabled = true,
}: WealthTrendProps) => {
    const styles = useStyles()
    const { privacyMode } = useSettings()

    const { data, isPending, isUnavailableOnNetwork, isPartial } =
        usePortfolioHistoryQuery(sources, period, currencyScope, enabled)

    // Trend follows the fiat value, like the chart — the ALGO-denominated
    // value is flat for an all-ALGO account no matter what the price does.
    // Unpriced points are dropped first: defaulting one end to 0 would report
    // a swing between a real value and a rate we simply don't have.
    const [absolute, percentage, isPositive, hasPoints] = useMemo(() => {
        const priced =
            data?.flatMap(point =>
                point.preferredValue ? [point.preferredValue] : [],
            ) ?? []
        const firstDp = priced.at(0) ?? new Decimal(0)
        const lastDp = priced.at(-1) ?? new Decimal(0)

        return [
            lastDp.minus(firstDp),
            percentChange(firstDp, lastDp),
            lastDp.greaterThanOrEqualTo(firstDp),
            priced.length > 0,
        ] as const
    }, [data])

    // A failed or empty chain leaves no history to measure a change over, and
    // a chain the chart left out leaves the change short of the total beside it.
    return isPending ||
        !hasPoints ||
        privacyMode ||
        isUnavailableOnNetwork ||
        isPartial ? (
        <></>
    ) : (
        <PWView style={styles.container}>
            <PreferredAmount
                value={absolute}
                density='compact'
                showSymbol
                style={isPositive ? styles.itemUp : styles.itemDown}
            />
            <TrendIndicator
                percentage={percentage}
                hasIconBackground
                shouldHideIconWhenZero
            />
        </PWView>
    )
}
