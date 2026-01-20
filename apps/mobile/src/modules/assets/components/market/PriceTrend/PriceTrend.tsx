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

import { View } from 'react-native'
import { PWIcon, PWText } from '@components/core'
import { useStyles } from './styles'
import { formatCurrency, HistoryPeriod } from '@perawallet/wallet-core-shared'
import Decimal from 'decimal.js'
import { useMemo } from 'react'
import {
    AssetPriceHistoryItem,
    useAssetPriceHistoryQuery,
} from '@perawallet/wallet-core-assets'
import { useCurrency } from '@perawallet/wallet-core-currencies'

export type PriceTrendProps = {
    assetId: string
    period: HistoryPeriod
    selectedDataPoint?: AssetPriceHistoryItem | null
    showAbsolute?: boolean
}

export const PriceTrend = ({
    assetId,
    period,
    selectedDataPoint,
    showAbsolute = false,
}: PriceTrendProps) => {
    const styles = useStyles()
    const { preferredCurrency } = useCurrency()

    const { data: chartData } = useAssetPriceHistoryQuery(
        assetId,
        period ?? 'one-week',
    )

    const [calculatedPercentage, calculatedValue] = useMemo(() => {
        const dataPoints = chartData?.map(p => p.fiatPrice) ?? []

        const firstDp = dataPoints.at(0) ?? Decimal(0)
        const lastDp =
            selectedDataPoint?.fiatPrice ?? dataPoints.at(-1) ?? Decimal(0)

        if (lastDp.isZero()) return [Decimal(0), Decimal(0)]

        return [
            lastDp.minus(firstDp).div(lastDp).mul(100),
            lastDp.minus(firstDp),
        ]
    }, [chartData, selectedDataPoint])

    const changePercentage = calculatedPercentage ?? Decimal(0)
    const changeValue = calculatedValue

    const isPositive = changePercentage.greaterThanOrEqualTo(Decimal(0))

    return (
        <View style={styles.container}>
            {showAbsolute && changeValue && (
                <PWText
                    style={isPositive ? styles.itemUp : styles.itemDown}
                    variant='h4'
                >
                    {isPositive ? '+' : '-'}
                    {formatCurrency(
                        changeValue.abs(),
                        2,
                        preferredCurrency,
                        undefined,
                        true,
                    )}
                </PWText>
            )}
            <View style={styles.percentageContainer}>
                <PWIcon
                    name={isPositive ? 'arrow-up' : 'arrow-down'}
                    variant={isPositive ? 'helper' : 'error'}
                    size='sm'
                    style={
                        isPositive ? styles.trendIconUp : styles.trendIconDown
                    }
                />
                <PWText
                    style={isPositive ? styles.itemUp : styles.itemDown}
                    variant='h4'
                >
                    {Decimal.abs(changePercentage).toFixed(2)}%
                </PWText>
            </View>
        </View>
    )
}
