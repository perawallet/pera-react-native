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
import {
    formatNumber,
    formatWithUnits,
} from '@perawallet/wallet-core-shared'
import CurrencyDisplay from '../../../currency/currency-display/CurrencyDisplay'
import Decimal from 'decimal.js'
import { Text } from '@rneui/themed'
import PWIcon from '../../../common/icons/PWIcon'
import PWView from '../../../common/view/PWView'
import { useMemo } from 'react'
import { PeraAsset, useAssetFiatPricesQuery } from '@perawallet/wallet-core-assets'
import { useCurrency } from '@perawallet/wallet-core-currencies'

type AssetMarketStatsProps = {
    assetDetails: PeraAsset
}

const AssetMarketStats = ({ assetDetails }: AssetMarketStatsProps) => {
    const styles = useStyles()
    const { preferredCurrency } = useCurrency()

    const supply = useMemo(() => {
        if (!assetDetails.totalSupply) {
            return '-'
        }

        const totalSupplyMicroUnits = new Decimal(assetDetails.totalSupply)
        const totalSupply = totalSupplyMicroUnits.div(
            Decimal.pow(10, assetDetails.decimals),
        )
        const { amount, unit } = formatWithUnits(totalSupply)
        const { integer, fraction } = formatNumber(amount, 2)
        return `${integer}${fraction}${unit}`
    }, [assetDetails.totalSupply, assetDetails.decimals])

    const { data } = useAssetFiatPricesQuery()

    const price = useMemo(() => {
        if (!data) {
            return '---'
        }

        const fiatPriceAsset = data.get(assetDetails.assetId)
        return fiatPriceAsset?.fiatPrice ?? '---'
    }, [data, assetDetails.assetId])

    return (
        <PWView style={styles.container}>
            <Text style={styles.sectionTitle}>Statistics</Text>
            <PWView style={styles.statsContainer}>
                <PWView style={styles.itemContainer}>
                    <Text style={styles.label}>Price</Text>
                    <CurrencyDisplay
                        h2
                        value={new Decimal(price)}
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
