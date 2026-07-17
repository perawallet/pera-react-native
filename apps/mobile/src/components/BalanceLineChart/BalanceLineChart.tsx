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

    return (
        <PWView style={style}>
            {isPending ? (
                <LoadingView
                    variant='circle'
                    size='lg'
                />
            ) : isError ? (
                // A failed request must not masquerade as "no history" — show a
                // distinct error state so the user can retry rather than assume
                // there's nothing to display.
                <EmptyView
                    title={t('common.error.title')}
                    body={errorBody ?? t('common.error.body')}
                    button={
                        onRetry ? (
                            <PWButton
                                variant='link'
                                title={t('common.retry.label')}
                                onPress={onRetry}
                                testID='balance-chart-retry'
                            />
                        ) : undefined
                    }
                />
            ) : !dataPoints?.length ? (
                <EmptyView
                    title=''
                    body={emptyBody}
                />
            ) : (
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
            )}
        </PWView>
    )
}
