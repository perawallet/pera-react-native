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
    useAccountsAssetsBalanceHistoryQuery,
    usePortfolioHistoryQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PreferredAmount } from '@components/PreferredAmount'
import { TrendIndicator } from '@components/TrendIndicator'

/** One asset held by one account on one chain. */
export type WealthTrendHolding = {
    account: WalletAccount
    assetId: string
    scope: ChainScope
}

export type WealthTrendProps = {
    period: HistoryPeriod
    /** Gate the (slow) history fetch on chart visibility. */
    enabled?: boolean
} & (
    | {
          /** Trended as one summed series. */
          sources: AccountHoldingSource[]
          currencyScope: ChainScope
          holding?: never
      }
    | {
          holding: WealthTrendHolding
          sources?: never
          currencyScope?: never
      }
)

const NO_SOURCES: AccountHoldingSource[] = []

export const WealthTrend = (props: WealthTrendProps) => {
    const { period, enabled = true, holding } = props
    const styles = useStyles()
    const { privacyMode } = useSettings()

    // Both queries are called every render; the mode that isn't in use is gated off.
    const portfolioHistory = usePortfolioHistoryQuery(
        holding ? NO_SOURCES : props.sources,
        period,
        holding ? holding.scope : props.currencyScope,
        enabled && !holding,
    )
    const holdingHistory = useAccountsAssetsBalanceHistoryQuery(
        holding?.account ?? null,
        holding?.assetId ?? '',
        period,
        holding ? holding.scope : props.currencyScope,
        enabled && !!holding,
    )

    const { data, isPending, isUnavailableOnNetwork } = holding
        ? holdingHistory
        : portfolioHistory
    const isPartial = !holding && portfolioHistory.isPartial

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
        <PWView
            testID='wealth_trend'
            style={styles.container}
        >
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
