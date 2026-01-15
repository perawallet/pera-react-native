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
import { formatNumber, formatWithUnits } from '@perawallet/wallet-core-shared'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import Decimal from 'decimal.js'
import { PWText, PWView } from '@components/core'
import { useMemo } from 'react'
import {
    PeraAsset,
    useAssetFiatPricesQuery,
} from '@perawallet/wallet-core-assets'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useLanguage } from '@hooks/language'
import { InfoButton } from '@components/InfoButton'

type AssetMarketStatsProps = {
    assetDetails: PeraAsset
}

export const AssetMarketStats = ({ assetDetails }: AssetMarketStatsProps) => {
    const styles = useStyles()
    const { preferredCurrency } = useCurrency()
    const { t } = useLanguage()

    const supply = useMemo(() => {
        if (!assetDetails.totalSupply) {
            return '-'
        }

        const totalSupplyMicroUnits = new Decimal(assetDetails.totalSupply ?? 0)
        const totalSupply = totalSupplyMicroUnits.div(
            Decimal.pow(10, assetDetails.decimals ?? 0),
        )
        const { amount, unit } = formatWithUnits(totalSupply)
        const { integer, fraction } = formatNumber(amount, 2)
        return `${integer}${fraction}${unit}`
    }, [assetDetails.totalSupply, assetDetails.decimals])

    const { data } = useAssetFiatPricesQuery()

    const price = useMemo(() => {
        if (!data) {
            return null
        }

        const fiatPriceAsset = data.get(assetDetails.assetId)
        return fiatPriceAsset?.fiatPrice ?? null
    }, [data, assetDetails.assetId])

    return (
        <PWView style={styles.container}>
            <PWText style={styles.sectionTitle}>
                {t('asset_details.markets.stats')}
            </PWText>
            <PWView style={styles.statsContainer}>
                <PWView style={styles.itemContainer}>
                    <PWText style={styles.label}>
                        {t('asset_details.markets.price')}
                    </PWText>
                    <CurrencyDisplay
                        h2
                        value={price}
                        currency={preferredCurrency}
                        precision={6}
                        minPrecision={2}
                    />
                </PWView>

                <PWView style={styles.itemContainer}>
                    <PWView style={styles.labelContainer}>
                        <PWText style={styles.label}>
                            {t('asset_details.markets.total_supply')}
                        </PWText>
                        <InfoButton
                            variant='secondary'
                            title={t(
                                'asset_details.markets.total_supply_info_title',
                            )}
                        >
                            <PWText>
                                {t(
                                    'asset_details.markets.total_supply_info_body',
                                )}
                            </PWText>
                        </InfoButton>
                    </PWView>
                    <PWText
                        style={styles.value}
                        variant='h2'
                    >
                        {supply}
                    </PWText>
                </PWView>
            </PWView>
        </PWView>
    )
}
