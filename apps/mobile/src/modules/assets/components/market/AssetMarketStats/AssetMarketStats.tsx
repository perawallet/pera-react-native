/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import { PreferredAmount } from '@components/PreferredAmount'
import { Decimal } from 'decimal.js'
import { PWText, PWView } from '@components/core'
import { useMemo } from 'react'
import { toWholeUnits, type PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { AssetSupplyDisplay } from '@modules/assets/types/asset-details-display'
import { useLanguage } from '@hooks/useLanguage'
import { InfoButton } from '@components/InfoButton'
import { UNKNOWN_AMOUNT_PLACEHOLDER } from '@constants/ui'

export type AssetMarketStatsProps = {
    assetDetails: PeraAsset
    scope: ChainScope
    supply: AssetSupplyDisplay
}

export const AssetMarketStats = ({
    assetDetails,
    scope,
    supply,
}: AssetMarketStatsProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const supplyText = useMemo(() => {
        if (supply.amount === null) {
            return UNKNOWN_AMOUNT_PLACEHOLDER
        }

        const wholeUnits = toWholeUnits(supply.amount, assetDetails)
        const { amount, unit } = formatWithUnits(wholeUnits)
        const { integer, fraction } = formatNumber(amount, 2)
        return `${integer}${fraction}${unit}`
    }, [supply.amount, assetDetails])

    return (
        <PWView style={styles.container}>
            <PWText
                style={styles.sectionTitle}
                truncate
            >
                {t('asset_details.markets.stats')}
            </PWText>
            <PWView style={styles.statsContainer}>
                <PWView style={styles.itemContainer}>
                    <PWText style={styles.label}>
                        {t('asset_details.markets.price')}
                    </PWText>
                    <PreferredAmount
                        variant='h2'
                        sourceAmount={new Decimal(1)}
                        sourceAssetId={assetDetails.assetId}
                        scope={scope}
                    />
                </PWView>

                <PWView style={styles.itemContainer}>
                    <PWView style={styles.labelContainer}>
                        <PWText style={styles.label}>
                            {t(supply.labelKey)}
                        </PWText>
                        <InfoButton
                            variant='secondary'
                            title={t(supply.labelKey)}
                        >
                            <PWText>{t(supply.infoBodyKey)}</PWText>
                        </InfoButton>
                    </PWView>
                    <PWText
                        style={styles.value}
                        variant='h2'
                    >
                        {supplyText}
                    </PWText>
                </PWView>
            </PWView>
        </PWView>
    )
}
