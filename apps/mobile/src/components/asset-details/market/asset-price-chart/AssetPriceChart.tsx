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

import { useStyles } from './styles'
import { LineChart } from 'react-native-gifted-charts'

import PWView from '../../../common/view/PWView'
import {
    PeraAsset,
    useCurrencyConverter,
    useAssetPriceHistory,
    HistoryPeriod,
    AssetPriceHistoryItem,
} from '@perawallet/core'
import { Suspense, useCallback, useMemo, useState } from 'react'
import { useTheme } from '@rneui/themed'
import Decimal from 'decimal.js'
import LoadingView from '../../../common/loading/LoadingView'

const FOCUS_DEBOUNCE_TIME = 200

type AssetPriceChartProps = {
    asset: PeraAsset
    period: HistoryPeriod
    onSelectionChanged: (item: AssetPriceHistoryItem | null) => void
}

const AssetPriceChart = ({
    onSelectionChanged,
    asset,
    period,
}: AssetPriceChartProps) => {
    const { theme } = useTheme()
    const { usdToPreferred } = useCurrencyConverter()
    const themeStyle = useStyles()
    const [lastSentIndex, setLastSentIndex] = useState<number>()
    const [lastSentTime, setLastSentTime] = useState<number>(Date.now())

    const { data } = useAssetPriceHistory({
        params: {
            asset_id: asset.asset_id,
            period: period,
        },
    })

    const dataPoints = useMemo(
        () =>
            data?.map(p => {
                return {
                    value: usdToPreferred(Decimal(p.price)).toNumber(),
                    timestamp: p.datetime,
                }
            }) ?? [],
        [data, usdToPreferred],
    )

    const yAxisOffsets = useMemo(() => {
        if (dataPoints.length === 0) return [-1, 1]
        const minValue = Math.min(...dataPoints.map(p => p.value))
        const maxValue = Math.max(...dataPoints.map(p => p.value))
        if (minValue === 0 && maxValue === 0) {
            return [-1, 1]
        } else {
            return [minValue - minValue / 10, maxValue + maxValue / 10]
        }
    }, [dataPoints])

    const onFocus = useCallback(
        ({
            pointerIndex: index,
            pointerX,
        }: {
            pointerIndex: number
            pointerX: number
        }) => {
            if (Date.now() - lastSentTime > FOCUS_DEBOUNCE_TIME) {
                if (pointerX > 0 && index >= 0 && index !== lastSentIndex) {
                    const dataItem = dataPoints?.[index] ?? null
                    if (dataItem) {
                        onSelectionChanged({
                            datetime: dataItem.timestamp,
                            price: Number(dataItem.value),
                        })
                    }
                    setLastSentIndex(index)
                } else if (pointerX === 0) {
                    onSelectionChanged(null)
                    setLastSentIndex(undefined)
                }
                setLastSentTime(Date.now())
            }
        },
        [
            dataPoints,
            onSelectionChanged,
            lastSentIndex,
            lastSentTime,
            setLastSentIndex,
        ],
    )

    return (
        <Suspense
            fallback={
                <LoadingView
                    variant='circle'
                    size='lg'
                />
            }
        >
            <PWView style={themeStyle.container}>
                <LineChart
                    data={dataPoints}
                    hideAxesAndRules
                    height={140}
                    color={theme.colors.helperPositive}
                    startFillColor='#28A79B'
                    endFillColor='#28A79B'
                    startOpacity={0.3}
                    endOpacity={0.0}
                    areaChart
                    yAxisLabelWidth={1}
                    hideYAxisText
                    yAxisOffset={yAxisOffsets[0]}
                    maxValue={yAxisOffsets[1]}
                    initialSpacing={0}
                    endSpacing={0}
                    showStripOnFocus
                    showDataPointOnFocus
                    animateOnDataChange
                    animationDuration={200}
                    onDataChangeAnimationDuration={200}
                    pointerConfig={{
                        showPointerStrip: true,
                        pointerStripColor: theme.colors.textGrayLighter,
                        pointerStripWidth: 1,
                        pointerStripHeight: 140,
                        pointerColor: theme.colors.helperPositive,
                        strokeDashArray: [6, 2],
                    }}
                    getPointerProps={onFocus}
                    disableScroll
                    adjustToWidth
                />
            </PWView>
        </Suspense>
    )
}

export default AssetPriceChart
