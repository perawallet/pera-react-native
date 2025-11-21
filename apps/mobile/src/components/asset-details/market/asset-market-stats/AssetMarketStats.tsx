import { useStyles } from './styles'
import {
    formatNumber,
    formatWithUnits,
    PeraAsset,
    useCurrencyConverter,
} from '@perawallet/core'
import CurrencyDisplay from '../../../currency/currency-display/CurrencyDisplay'
import Decimal from 'decimal.js'
import { Text } from '@rneui/themed'
import PWIcon from '../../../common/icons/PWIcon'
import PWView from '../../../common/view/PWView'
import { useMemo } from 'react'

type AssetMarketStatsProps = {
    assetDetails: PeraAsset
}

const AssetMarketStats = ({ assetDetails }: AssetMarketStatsProps) => {
    const styles = useStyles()
    const { preferredCurrency } = useCurrencyConverter()

    const supply = useMemo(() => {
        if (!assetDetails.total_supply) {
            return '-'
        }

        const totalSupplyMicroUnits = new Decimal(assetDetails.total_supply)
        const totalSupply = totalSupplyMicroUnits.div(
            Decimal.pow(10, assetDetails.fraction_decimals),
        )
        const { amount, unit } = formatWithUnits(totalSupply)
        const { integer, fraction } = formatNumber(amount, 2)
        return `${integer}${fraction}${unit}`
    }, [assetDetails.total_supply, assetDetails.fraction_decimals])

    return (
        <PWView style={styles.container}>
            <Text style={styles.sectionTitle}>Statistics</Text>
            <PWView style={styles.statsContainer}>
                <PWView style={styles.itemContainer}>
                    <Text style={styles.label}>Price</Text>
                    <CurrencyDisplay
                        h2
                        value={new Decimal(assetDetails.usd_value ?? 0)}
                        currency={preferredCurrency}
                        precision={6}
                        minPrecision={2}
                    />
                </PWView>

                <PWView style={styles.itemContainer}>
                    <PWView style={styles.labelContainer}>
                        <Text style={styles.label}>Total Supply</Text>
                        <PWIcon
                            name='info'
                            size='sm'
                            variant='secondary'
                        />
                    </PWView>
                    <Text
                        style={styles.value}
                        h2
                    >
                        {supply}
                    </Text>
                </PWView>
            </PWView>
        </PWView>
    )
}

export default AssetMarketStats
