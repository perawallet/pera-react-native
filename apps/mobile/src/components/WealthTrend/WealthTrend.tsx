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

import { PWSkeleton, PWText, PWView } from '@components/core'
import { useStyles } from './styles'
import {
    formatPercentage,
    type HistoryPeriod,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { Decimal } from 'decimal.js'
import { useSettings } from '@perawallet/wallet-core-settings'
import type { AccountHoldingSource } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PreferredAmount } from '@components/PreferredAmount'
import {
    usePortfolioTrend,
    type PortfolioTrendDirection,
} from '@hooks/usePortfolioTrend'

export type WealthTrendProps = {
    /** Trended as one summed series. */
    sources: AccountHoldingSource[]
    currencyScope: ChainScope
    period: HistoryPeriod
}

const SIGN_BY_DIRECTION: Record<PortfolioTrendDirection, string> = {
    up: '+',
    down: '-',
    flat: '',
}

// A move that rounds to nothing reads 0.00%; a zero start has no percentage to give.
const percentageTextOf = (
    direction: PortfolioTrendDirection,
    percentage: Decimal,
): Nullable<string> => {
    if (direction === 'flat') return formatPercentage(0)
    return percentage.isZero() ? null : formatPercentage(percentage.abs())
}

export const WealthTrend = ({
    sources,
    currencyScope,
    period,
}: WealthTrendProps) => {
    const styles = useStyles()
    const { privacyMode } = useSettings()
    const {
        trendAbsolute,
        trendPercentage,
        trendDirection,
        hasNoTrend,
        isPending,
    } = usePortfolioTrend(sources, period, currencyScope, true)

    if (privacyMode) return null

    if (isPending) {
        return (
            <PWView
                testID='wealth_trend_loading'
                style={styles.loading}
            >
                <PWSkeleton style={styles.loadingBar} />
            </PWView>
        )
    }

    // The history reports no change when a chain is missing, failed or unpriced.
    if (hasNoTrend) return null

    const sign = SIGN_BY_DIRECTION[trendDirection]
    const percentageText = percentageTextOf(trendDirection, trendPercentage)
    const directionStyle = {
        up: styles.itemUp,
        down: styles.itemDown,
        flat: styles.itemFlat,
    }[trendDirection]

    return (
        <PWText
            testID='wealth_trend'
            variant='h4'
            style={directionStyle}
            numberOfLines={1}
        >
            {/* Rounded like the direction, so a sub-cent move can't hit the fiat floor and print "< $0.01". */}
            <PreferredAmount
                isInline
                prefix={sign}
                value={trendAbsolute.abs().toDecimalPlaces(2)}
                density='compact'
                variant='h4'
                style={directionStyle}
            />
            {percentageText && ` (${sign}${percentageText})`}
        </PWText>
    )
}
