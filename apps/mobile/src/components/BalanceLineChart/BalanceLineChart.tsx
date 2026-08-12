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
import { LinearGradient, vec } from '@shopify/react-native-skia'
import { Area, CartesianChart, Line, useChartPressState } from 'victory-native'
import { useTheme } from '@rneui/themed'
import { PWButton, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { useLanguage } from '@hooks/useLanguage'
import {
    CHART_ANIMATION_DURATION,
    CHART_LINE_THICKNESS,
    CHART_PRESS_ACTIVE_OFFSET_X,
    CHART_PRESS_FAIL_OFFSET_Y,
} from '@constants/ui'
import { getChartYAxisRange } from '@utils/chart'
import { useBalanceLineChart } from './useBalanceLineChart'
import { ChartPressIndicator } from './ChartPressIndicator'
import { useChartPressSelection } from './useChartPressSelection'
import { useStableChartData } from './useStableChartData'
import { useStyles } from './styles'

import type { StyleProp, ViewStyle } from 'react-native'

// Legacy literal, carried over verbatim so the port stays visually a no-op. It
// is deliberately not theme.colors.positive (a different turquoise) and wants a
// semantic token of its own.
const AREA_FILL_COLOR = '#28A79B'
const AREA_FILL_TOP_OPACITY = '4D' // 30%
const AREA_FILL_BOTTOM_OPACITY = '00'

const CHART_ANIMATION = {
    type: 'timing',
    duration: CHART_ANIMATION_DURATION,
} as const

// Omitting `yAxis` is not enough to hide it: victory gates the X axis on the
// `xAxis` prop but the Y axis on its internally-derived `yAxes` array, which is
// always populated — so the default 25%-black hairline gridlines render either
// way (obvious in light mode, near-invisible in dark). Zero width is the off
// switch; YAxis skips the path when lineWidth <= 0, and tick labels need a
// `font` we never pass. Hoisted so the prop identity stays stable.
const HIDDEN_Y_AXIS = [{ lineWidth: 0 }]

// Shared area line chart for the wealth/asset-balance/asset-price charts, which
// render an identical chart and only differ in how they fetch their series and
// which field of it they plot. Mapping and scrub wiring live here so each
// caller is just its query plus this component.
type BalanceLineChartProps<T> = {
    /** Source series as fetched; undefined while the query has no data. */
    series: T[] | undefined
    /** Extracts the plotted value from a series item. */
    getValue: (item: T) => number
    /** Reports the scrub-focused series item, or null when the touch ends. */
    onSelectionChanged: (item: T | null) => void
    isPending: boolean
    emptyBody: string
    /** When true, render an error state (with retry) instead of the empty copy. */
    isError?: boolean
    /** True while the query's fetch is offline-paused (fetchStatus 'paused'). */
    isPaused?: boolean
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
    errorBody,
    onRetry,
    style,
}: BalanceLineChartProps<T>) => {
    const { theme } = useTheme()
    const { t } = useLanguage()
    const styles = useStyles()

    const dataPoints = useStableChartData(series, getValue)

    // getChartYAxisRange speaks gifted-charts' idiom, where maxValue is the span
    // above the offset rather than the top of the axis.
    const yDomain = useMemo<[number, number]>(() => {
        const { yAxisOffset, maxValue } = getChartYAxisRange(dataPoints)
        return [yAxisOffset, yAxisOffset + maxValue]
    }, [dataPoints])

    // Only the shared values are used; the hook's JS `isActive` boolean lands a
    // render too late to gate anything on (see ChartPressIndicator).
    const { state: pressState } = useChartPressState({
        x: 0,
        y: { value: 0 },
    })
    useChartPressSelection(pressState, series, onSelectionChanged)

    const { renderState, handleRetry } = useBalanceLineChart({
        hasData: dataPoints.length > 0,
        isPaused,
        isError,
        isPending,
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
                    <PWView style={styles.canvas}>
                        <CartesianChart
                            data={dataPoints}
                            xKey='index'
                            yKeys={['value']}
                            domain={{ y: yDomain }}
                            yAxis={HIDDEN_Y_AXIS}
                            padding={0}
                            domainPadding={0}
                            chartPressState={pressState}
                            // Without an explicit pan config victory applies
                            // activateAfterLongPress(100), i.e. a hold before
                            // the scrub starts — the lag we're removing.
                            chartPressConfig={{
                                pan: {
                                    activeOffsetX: CHART_PRESS_ACTIVE_OFFSET_X,
                                    failOffsetY: CHART_PRESS_FAIL_OFFSET_Y,
                                },
                            }}
                        >
                            {({ points, chartBounds }) => (
                                <>
                                    <Area
                                        points={points.value}
                                        y0={chartBounds.bottom}
                                        curveType='linear'
                                        animate={CHART_ANIMATION}
                                    >
                                        <LinearGradient
                                            start={vec(0, chartBounds.top)}
                                            end={vec(0, chartBounds.bottom)}
                                            colors={[
                                                `${AREA_FILL_COLOR}${AREA_FILL_TOP_OPACITY}`,
                                                `${AREA_FILL_COLOR}${AREA_FILL_BOTTOM_OPACITY}`,
                                            ]}
                                        />
                                    </Area>
                                    <Line
                                        points={points.value}
                                        color={theme.colors.positive}
                                        strokeWidth={CHART_LINE_THICKNESS}
                                        curveType='linear'
                                        animate={CHART_ANIMATION}
                                    />
                                    <ChartPressIndicator
                                        pressState={pressState}
                                        top={chartBounds.top}
                                        bottom={chartBounds.bottom}
                                        stripColor={
                                            theme.colors.textGrayLighter
                                        }
                                        dotColor={theme.colors.positive}
                                    />
                                </>
                            )}
                        </CartesianChart>
                    </PWView>
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
