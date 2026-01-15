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
import { useLanguage } from '@hooks/language'
import { LineChart } from 'react-native-gifted-charts'

import { PWView } from '@components/core/PWView'
import { HistoryPeriod } from '@perawallet/wallet-core-shared'

import { useCallback, useMemo, useState } from 'react'
import { useTheme } from '@rneui/themed'
import {
    AccountBalanceHistoryItem,
    useAccountsAssetsBalanceHistoryQuery,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { PeraAsset } from '@perawallet/wallet-core-assets'
import { LoadingView } from '@components/LoadingView'
import { EmptyView } from '@components/EmptyView'
import {
    CHART_ANIMATION_DURATION,
    CHART_FOCUS_DEBOUNCE_TIME,
    CHART_HEIGHT,
} from '@constants/ui'

type DataPoint = {
    timestamp: Date
    value: number
}

type AssetWealthChartProps = {
    account: WalletAccount
    asset: PeraAsset
    period: HistoryPeriod
    onSelectionChanged: (item: AccountBalanceHistoryItem | null) => void
}

export const AssetWealthChart = ({
    onSelectionChanged,
    account,
    asset,
    period,
}: AssetWealthChartProps) => {
    const { theme } = useTheme()
    const themeStyle = useStyles()
    const { t } = useLanguage()
    const [lastSentIndex, setLastSentIndex] = useState<number>()
    const [lastSentTime, setLastSentTime] = useState<number>(Date.now())

    const { data, isPending } = useAccountsAssetsBalanceHistoryQuery(
        account,
        asset.assetId,
        period,
    )

    const dataPoints = useMemo(() => {
        return (data?.map(p => {
            return {
                value: p.fiatValue.toNumber(),
                timestamp: p.datetime,
            }
        }) ?? []) as DataPoint[]
    }, [data])

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
            if (Date.now() - lastSentTime > CHART_FOCUS_DEBOUNCE_TIME) {
                if (pointerX > 0 && index >= 0 && index !== lastSentIndex) {
                    const dataItem = data?.[index]
                    setLastSentIndex(index)
                    if (dataItem) {
                        onSelectionChanged(dataItem)
                    }
                } else if (pointerX === 0) {
                    onSelectionChanged(null)
                    setLastSentIndex(undefined)
                }
                setLastSentTime(Date.now())
            }
        },
        [
            data,
            onSelectionChanged,
            lastSentIndex,
            lastSentTime,
            setLastSentIndex,
        ],
    )

    if (isPending) {
        return (
            <LoadingView
                variant='circle'
                size='lg'
            />
        )
    }

    return (
        <PWView style={themeStyle.container}>
            {!dataPoints?.length ? (
                <EmptyView
                    title=''
                    body={t('common.wealth_chart.asset_empty_body')}
                />
            ) : (
                <LineChart
                    data={dataPoints}
                    hideAxesAndRules
                    height={CHART_HEIGHT}
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
                    animationDuration={CHART_ANIMATION_DURATION}
                    onDataChangeAnimationDuration={CHART_ANIMATION_DURATION}
                    pointerConfig={{
                        showPointerStrip: true,
                        pointerStripColor: theme.colors.textGrayLighter,
                        pointerStripWidth: 1,
                        pointerStripHeight: CHART_HEIGHT,
                        pointerColor: theme.colors.helperPositive,
                        strokeDashArray: [6, 2],
                    }}
                    getPointerProps={onFocus}
                    disableScroll
                    adjustToWidth
                />
            )}
        </PWView>
    )
}
