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

import { useEffect, useRef } from 'react'
import type { Decimal } from 'decimal.js'
import type { AccountHoldingSource } from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { HistoryPeriod, Nullable } from '@perawallet/wallet-core-shared'
import { usePortfolioTrend } from './usePortfolioTrend'

export type UsePortfolioChangeParams = {
    chartSources: AccountHoldingSource[]
    scope: ChainScope
    chartPeriod: HistoryPeriod
    isChartShown: boolean
    /** False when the card has no fiat total or history to measure, or its drawer is closed. */
    isEnabled: boolean
}

export type UsePortfolioChangeResult = {
    changePeriod: HistoryPeriod
    /** In the preferred currency, display units. */
    changeAbsolute: Decimal
    changePercentage: Decimal
    hasChange: boolean
}

type SettledChange = { absolute: Decimal; percentage: Decimal }

export const usePortfolioChange = ({
    chartSources,
    scope,
    chartPeriod,
    isChartShown,
    isEnabled,
}: UsePortfolioChangeParams): UsePortfolioChangeResult => {
    const changePeriod: HistoryPeriod = isChartShown ? chartPeriod : 'one-day'

    const { trendAbsolute, trendPercentage, hasNoTrend, isPending } =
        usePortfolioTrend(chartSources, changePeriod, scope, isEnabled)

    // A new period has no cached history until it loads, and dropping the line
    // for that gap resizes the card in the middle of the chart's expand.
    const settled = useRef<Nullable<SettledChange>>(null)
    useEffect(() => {
        if (!isEnabled || (!isPending && hasNoTrend)) {
            settled.current = null
        } else if (!isPending) {
            settled.current = {
                absolute: trendAbsolute,
                percentage: trendPercentage,
            }
        }
    }, [isEnabled, isPending, hasNoTrend, trendAbsolute, trendPercentage])

    const held = isEnabled && isPending ? settled.current : null

    return {
        changePeriod,
        changeAbsolute: held?.absolute ?? trendAbsolute,
        changePercentage: held?.percentage ?? trendPercentage,
        hasChange: isEnabled && (held !== null || (!isPending && !hasNoTrend)),
    }
}
