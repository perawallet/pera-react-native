/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import { useCallback, useMemo } from 'react'
import type { Decimal } from 'decimal.js'
import { useLanguage } from '@hooks/useLanguage'
import {
    type AccountHoldingSource,
    type AccountValueBasis,
    type PortfolioValueHistoryItem,
    useAccountBalancesHistoryQuery,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { type HistoryPeriod, type Nullable } from '@perawallet/wallet-core-shared'

export type UsePortfolioChartProps = {
    chartSources: AccountHoldingSource[]
    period: HistoryPeriod
    scope: ChainScope
    isChartShown: boolean
    basis: AccountValueBasis
    selectedPoint: Nullable<PortfolioValueHistoryItem>
    setSelectedPoint: (selected: Nullable<PortfolioValueHistoryItem>) => void
    onDataSelected?: (selected: Nullable<PortfolioValueHistoryItem>) => void
}

export type UsePortfolioChartResult = {
    selectedNativeValue: Nullable<Decimal>
    trendPeriodLabel: Record<HistoryPeriod, string>
    chartSelectionChanged: (selected: Nullable<PortfolioValueHistoryItem>) => void
}

export const usePortfolioChart = ({
    chartSources,
    period,
    scope,
    isChartShown,
    basis,
    selectedPoint,
    setSelectedPoint,
    onDataSelected,
}: UsePortfolioChartProps): UsePortfolioChartResult => {
    const { t } = useLanguage()

    // The native headline reads its scrubbed value from the single-chain
    // series, so only the native basis fetches it. There `chartSources` are
    // all on `scope`'s chain, so it shares the summed chart's cache entry.
    const nativeAddresses = useMemo(
        () => chartSources.map(({ address }) => address),
        [chartSources],
    )
    const { data: nativeHistoryData } = useAccountBalancesHistoryQuery(
        nativeAddresses,
        period,
        scope,
        isChartShown && basis === 'native',
    )

    // The chart reports fiat points only; the native headline reads the same
    // point from this single-chain series, which shares the chart's timestamps.
    const selectedNativeValue = useMemo(
        () =>
            selectedPoint
                ? (nativeHistoryData.find(
                      point =>
                          point.datetime.getTime() ===
                          selectedPoint.datetime.getTime(),
                  )?.nativeValue ?? null)
                : null,
        [nativeHistoryData, selectedPoint],
    )

    const trendPeriodLabel = useMemo<Record<HistoryPeriod, string>>(
        () => ({
            'one-day': t('portfolio.last_24_hours'),
            'one-week': t('portfolio.last_7_days'),
            'one-month': t('portfolio.last_30_days'),
            'one-year': t('portfolio.last_year'),
        }),
        [t],
    )

    const chartSelectionChanged = useCallback(
        (selected: Nullable<PortfolioValueHistoryItem>) => {
            setSelectedPoint(selected)
            onDataSelected?.(selected)
        },
        [setSelectedPoint, onDataSelected],
    )

    return {
        selectedNativeValue,
        trendPeriodLabel,
        chartSelectionChanged,
    }
}
