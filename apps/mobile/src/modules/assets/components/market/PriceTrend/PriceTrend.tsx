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

import { PWText, PWView } from '@components/core'
import { useStyles } from './styles'
import {
    formatCurrency,
    type HistoryPeriod,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { type AssetPriceHistoryItem } from '@perawallet/wallet-core-assets'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { TrendIndicator } from '@components/TrendIndicator'
import { usePriceTrend } from './usePriceTrend'

export type PriceTrendProps = {
    assetId: string
    period: HistoryPeriod
    selectedDataPoint?: Nullable<AssetPriceHistoryItem>
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

    const { changePercentage, changeValue, isPositive, isHidden } =
        usePriceTrend({ assetId, period, selectedDataPoint })

    if (isHidden) {
        return null
    }

    return (
        <PWView style={styles.container}>
            {showAbsolute && (
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
            <TrendIndicator
                percentage={changePercentage}
                hasIconBackground
                shouldHideIconWhenZero
            />
        </PWView>
    )
}
