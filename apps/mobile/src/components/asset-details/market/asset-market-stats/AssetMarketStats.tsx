import { useStyles } from './styles'
import { AssetDetailSerializerResponse, useCurrencyConverter } from '@perawallet/core'
import CurrencyDisplay from '../../../currency/currency-display/CurrencyDisplay'
import Decimal from 'decimal.js'
import { Text } from '@rneui/themed'
import PWIcon from '../../../common/icons/PWIcon'
import PWView from '../../../common/view/PWView'

type AssetMarketStatsProps = {
    assetDetails: AssetDetailSerializerResponse
}

const AssetMarketStats = ({ assetDetails }: AssetMarketStatsProps) => {
    const styles = useStyles()
    const { preferredCurrency } = useCurrencyConverter()

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
                            size="sm"
                            variant='secondary'
                        />
                    </PWView>
                    <Text style={styles.value} h2>
                        {/* //TODO: truncate and use suffix */}
                        {assetDetails.total_supply
                            ? new Decimal(assetDetails.total_supply).toFixed(2)
                            : '-'}
                    </Text>
                </PWView>
            </PWView>
        </PWView>
    )
}

export default AssetMarketStats
