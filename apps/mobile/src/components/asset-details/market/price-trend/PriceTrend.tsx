import { View } from 'react-native'
import { Text, useTheme } from '@rneui/themed'
import { useStyles } from './styles'
import {
    formatCurrency,
    useCurrency,
    useV1AssetsPriceChartList,
    V1AssetsPriceChartListQueryParamsPeriodEnum,
} from '@perawallet/core'
import PWIcon from '../../../common/icons/PWIcon'
import Decimal from 'decimal.js'
import { useMemo } from 'react'
import { ChartPeriod } from '../../../common/chart-period-selection/ChartPeriodSelection'

type PriceTrendProps = {
    assetId?: number
    period?: ChartPeriod
    changePercentage?: number
    changeValue?: Decimal
    showValue?: boolean
}

const PriceTrend = ({
    assetId,
    period,
    changePercentage: manualPercentage,
    changeValue: manualValue,
    showValue = false,
}: PriceTrendProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { preferredCurrency } = useCurrency()

    const { data: chartData } = useV1AssetsPriceChartList({
        params: {
            asset_id: assetId ?? 0,
            period: period as V1AssetsPriceChartListQueryParamsPeriodEnum,
        }
    },
        {
            query: {
                enabled: !!assetId && !!period,
            },
        })

    const [calculatedPercentage, calculatedValue] = useMemo(() => {
        if (manualPercentage !== undefined) {
            return [manualPercentage, manualValue]
        }

        const dataPoints =
            chartData?.[0]?.results?.map(p => Number(p.price)) ?? []

        const firstDp = dataPoints.at(0) ?? 0
        const lastDp = dataPoints.at(-1) ?? 0

        if (lastDp === 0) return [0, new Decimal(0)]

        return [
            ((firstDp - lastDp) / lastDp) * 100,
            new Decimal(lastDp - firstDp),
        ]
    }, [chartData, manualPercentage, manualValue])

    const changePercentage = calculatedPercentage ?? 0
    const changeValue = calculatedValue

    const isPositive = changePercentage >= 0

    return (
        <View style={styles.container}>
            {showValue && changeValue && (
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
