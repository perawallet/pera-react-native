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
import { LineChart } from 'react-native-gifted-charts'
import { useTheme } from '@rneui/themed'
import { PWButton, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { useChartPointerFocus } from '@hooks/useChartPointerFocus'
import { useLanguage } from '@hooks/useLanguage'
import { CHART_ANIMATION_DURATION, CHART_HEIGHT } from '@constants/ui'
import { getChartYAxisRange } from '@utils/chart'
import { useBalanceLineChart } from './useBalanceLineChart'

import type { StyleProp, ViewStyle } from 'react-native'

// Shared area line chart for the wealth/asset-balance/asset-price charts, which
// render an identical chart and only differ in how they fetch their series and
// which field of it they plot. Mapping and pointer-focus wiring live here so
// each caller is just its query plus this component.
type BalanceLineChartProps<T> = {
    /** Source series as fetched; undefined while the query has no data. */
    series: T[] | undefined
    /** Extracts the plotted value from a series item. */
    getValue: (item: T) => number
    /** Reports the pointer-focused series item, or null when focus leaves. */
    onSelectionChanged: (item: T | null) => void
    isPending: boolean
    emptyBody: string
    /** When true, render an error state (with retry) instead of the empty copy. */
    isError?: boolean
    /** True while the query's fetch is offline-paused (fetchStatus 'paused'). */
    isPaused?: boolean
    /** True when the active network has no Pera backend — renders the
     *  no-retry unavailable surface instead of spinning forever. */
    isUnavailableOnNetwork?: boolean
    /** Error-state body; falls back to a generic message when omitted. */
    errorBody?: string
    /** Triggers a refetch from the error state's retry button. */
    onRetry?: () => void
    style?: StyleProp<ViewStyle>
}

export const BalanceLineChart = <T,>({
    series,
    getValue,
    onSelectionChanged,
    isPending,
    emptyBody,
    isError = false,
    isPaused = false,
    isUnavailableOnNetwork = false,
    errorBody,
    onRetry,
    style,
}: BalanceLineChartProps<T>) => {
    const { theme } = useTheme()
    const { t } = useLanguage()
    const dataPoints = useMemo(
        () => series?.map(item => ({ value: getValue(item) })) ?? [],
        [series, getValue],
    )
    const getPointerProps = useChartPointerFocus(series, onSelectionChanged)
    const yAxisRange = useMemo(
        () => getChartYAxisRange(dataPoints),
        [dataPoints],
    )

    const { renderState, handleRetry } = useBalanceLineChart({
        hasData: dataPoints.length > 0,
        isPaused,
        isError,
        isPending,
        isUnavailableOnNetwork,
        onRetry,
    })

    const retryButton = handleRetry ? (
        <PWButton
            variant='link'
            title={t('common.retry.label')}
            onPress={handleRetry}
            testID='balance-chart-retry'
        />
    ) : undefined

    const renderContent = () => {
        switch (renderState) {
            case 'chart': {
                return (
                    <LineChart
                        data={dataPoints}
                        hideAxesAndRules
                        height={CHART_HEIGHT}
                        color={theme.colors.positive}
                        startFillColor='#28A79B'
                        endFillColor='#28A79B'
                        startOpacity={0.3}
                        endOpacity={0.0}
                        areaChart
                        yAxisLabelWidth={1}
                        hideYAxisText
                        yAxisOffset={yAxisRange.yAxisOffset}
                        maxValue={yAxisRange.maxValue}
                        initialSpacing={0}
                        endSpacing={0}
                        showStripOnFocus
                        showDataPointOnFocus
                        animateOnDataChange
                        animationDuration={CHART_ANIMATION_DURATION}
                        onDataChangeAnimationDuration={CHART_ANIMATION_DURATION}
                        pointerConfig={{
                            showPointerStrip: true,
                            pointerStripColor: theme.colors.textGrayLighter,
                            pointerStripWidth: 1,
                            pointerStripHeight: CHART_HEIGHT,
                            pointerColor: theme.colors.positive,
                            strokeDashArray: [6, 2],
                        }}
                        getPointerProps={getPointerProps}
                        disableScroll
                        adjustToWidth
                    />
                )
            }
            // No Pera backend exists for this network, so the query never
            // fires and stays isPending forever — this must be checked ahead
            // of loading/error, and retry is omitted because it can never
            // succeed here.
            case 'unavailable': {
                return (
                    <EmptyView
                        title={t('common.network_unavailable.title')}
                        body={t('common.network_unavailable.body')}
                    />
                )
            }
            // Offline must not masquerade as loading: a paused query reports
            // isPending forever, so it needs its own surface or the spinner
            // never yields and retry is unreachable (PERA-4581).
            case 'offline': {
                return (
                    <EmptyView
                        title={t('common.offline_mode')}
                        body={t('common.offline_refresh_body')}
                        button={retryButton}
                    />
                )
            }
            // A failed request must not masquerade as "no history" — show a
            // distinct error state so the user can retry.
            case 'error': {
                return (
                    <EmptyView
                        title={t('common.error.title')}
                        body={errorBody ?? t('common.error.body')}
                        button={retryButton}
                    />
                )
            }
            case 'loading': {
                return (
                    <LoadingView
                        variant='circle'
                        size='lg'
                    />
                )
            }
            case 'empty': {
                return (
                    <EmptyView
                        title=''
                        body={emptyBody}
                    />
                )
            }
        }
    }

    return <PWView style={style}>{renderContent()}</PWView>
}
