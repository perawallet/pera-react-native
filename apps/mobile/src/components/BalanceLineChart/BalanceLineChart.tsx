/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { CHART_ANIMATION_DURATION, CHART_HEIGHT } from '@constants/ui'
import { getChartYAxisRange } from '@utils/chart'

import type { StyleProp, ViewStyle } from 'react-native'

type ChartPoint = { value: number }

type ChartPointerEvent = {
    pointerIndex: number
    pointerX: number
}

// Shared area line chart for the wealth/asset-balance/asset-price charts, which
// render an identical chart and only differ in how they fetch and map their data.
type BalanceLineChartProps = {
    dataPoints: ChartPoint[]
    isPending: boolean
    emptyBody: string
    getPointerProps: (event: ChartPointerEvent) => void
    style?: StyleProp<ViewStyle>
}

export const BalanceLineChart = ({
    dataPoints,
    isPending,
    emptyBody,
    getPointerProps,
    style,
}: BalanceLineChartProps) => {
    const { theme } = useTheme()
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
