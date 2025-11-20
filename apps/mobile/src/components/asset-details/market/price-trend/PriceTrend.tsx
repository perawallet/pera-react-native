import { View } from 'react-native'
import { Text, useTheme } from '@rneui/themed'
import { useStyles } from './styles'
import {
    AssetPriceChartDataItem,
    AssetPriceChartPeriod,
    formatCurrency,
    useAssetPriceChartData,
    useCurrency,
} from '@perawallet/core'
import PWIcon from '../../../common/icons/PWIcon'
import Decimal from 'decimal.js'
import { useMemo } from 'react'
import { ChartPeriod } from '../../../common/chart-period-selection/ChartPeriodSelection'

type PriceTrendProps = {
    assetId?: number
    period?: ChartPeriod
    selectedDataPoint?: AssetPriceChartDataItem
    showAbsolute?: boolean
}

const PriceTrend = ({
    assetId,
    period,
    selectedDataPoint,
    showAbsolute = false
}: PriceTrendProps) => {
    const styles = useStyles()
    const { preferredCurrency } = useCurrency()

    const { data: chartData } = useAssetPriceChartData({
        params: {
            asset_id: assetId ?? 0,
            period: period as AssetPriceChartPeriod,
        }
    })

    const [calculatedPercentage, calculatedValue] = useMemo(() => {
        const dataPoints =
            chartData?.map(p => Number(p.price)) ?? []

        const firstDp = dataPoints.at(0) ?? 0
        const lastDp = selectedDataPoint?.price ?? (dataPoints.at(-1) ?? 0)

        if (lastDp === 0) return [0, new Decimal(0)]

        return [
            ((lastDp - firstDp) / lastDp) * 100,
            new Decimal(lastDp - firstDp),
        ]
    }, [chartData, selectedDataPoint])

    const changePercentage = calculatedPercentage ?? 0
    const changeValue = calculatedValue

    const isPositive = changePercentage >= 0

    return (
        <View style={styles.container}>
            {showAbsolute && changeValue && (
                <Text
                    style={isPositive ? styles.itemUp : styles.itemDown}
                    h4
                >
                    {isPositive ? '+' : '-'}
                    {formatCurrency(
                        changeValue.abs(),
                        2,
                        preferredCurrency,
                        undefined,
                        true,
                    )}
                </Text>
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
                <Text
                    style={isPositive ? styles.itemUp : styles.itemDown}
                    h4
                >
                    {Math.abs(changePercentage).toFixed(2)}%
                </Text>
            </View>
        </View>
    )
}

export default PriceTrend
