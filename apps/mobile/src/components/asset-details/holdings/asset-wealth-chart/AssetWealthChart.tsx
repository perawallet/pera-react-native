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
    WalletAccount,
    useV1AccountsAssetsBalanceHistoryList,
    V1AccountsAssetsBalanceHistoryListQueryParamsPeriodEnum,
    useCurrencyConverter,
    AccountWealthHistoryItem,
    AccountWealthHistorySerializerResponse,
} from '@perawallet/core'
import { useCallback, useMemo, useState } from 'react'
import { useTheme } from '@rneui/themed'
import { ChartPeriod } from '../../../common/chart-period-selection/ChartPeriodSelection'
import Decimal from 'decimal.js'

const FOCUS_DEBOUNCE_TIME = 200

type DataPoint = {
    timestamp: string
    value: number
}

type AssetWealthChartProps = {
    account: WalletAccount
    asset: PeraAsset
    period: ChartPeriod
    onSelectionChanged: (item: AccountWealthHistoryItem | null) => void
}

//TODO debug why this isn't showing data
const AssetWealthChart = ({
    onSelectionChanged,
    account,
    asset,
    period,
}: AssetWealthChartProps) => {
    const { theme } = useTheme()
    const { preferredCurrency, convertUSDToPreferredCurrency } =
        useCurrencyConverter()
    const themeStyle = useStyles()
    const [lastSentIndex, setLastSentIndex] = useState<number>()
    const [lastSentTime, setLastSentTime] = useState<number>(Date.now())

    const { data, isPending } = useV1AccountsAssetsBalanceHistoryList({
        account_address: account.address,
        asset_id: `${asset.asset_id}`,
        params: {
            period: period as V1AccountsAssetsBalanceHistoryListQueryParamsPeriodEnum,
            currency: preferredCurrency,
        },
    })

    const dataPoints = useMemo(
        () => {
            // @ts-ignore: The generated type is unknown
            return (data?.results?.map((p: any) => {
                return {
                    value: convertUSDToPreferredCurrency(
                        new Decimal(p.usd_value ?? 0),
                    ).toNumber(),
                    timestamp: p.datetime,
                }
            }) ?? []) as DataPoint[]
        }, [data, convertUSDToPreferredCurrency],
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
                    const dataItem =
                        // @ts-ignore: The generated type is unknown
                        ((data as any)?.results?.[index]) ?? null
                    setLastSentIndex(index)
                    if (dataItem) {
                        onSelectionChanged({
                            algo_value: dataItem.amount,
                            datetime: dataItem.datetime,
                            usd_value: dataItem.usd_value,
                            value_in_currency: dataItem.value_in_currency,
                            round: 0,
                        })
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

    if (!isPending && !dataPoints?.length) {
        return <></>
    }

    return (
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
    )
}

export default AssetWealthChart
