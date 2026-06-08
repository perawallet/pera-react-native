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

import { formatDatetime } from '@perawallet/wallet-core-shared'
import { PWText, PWView } from '@components/core'
import { AssetWealthChart } from '../AssetWealthChart/AssetWealthChart'
import { ChartPeriodSelection } from '@components/ChartPeriodSelection'
import { useEffect, useMemo } from 'react'
import { useChartInteraction } from '@hooks/useChartInteraction'
import { AssetActionButtons } from '../AssetActionButtons/AssetActionButtons'
import { AssetTransactionList } from '../AssetTransactionList/AssetTransactionList'

import { useStyles } from './styles'
import {
    AssetFavoriteButton,
    AssetNotificationButton,
    AssetTitle,
} from '@modules/assets/components'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'
import { Decimal } from 'decimal.js'
import {
    type AccountBalanceHistoryItem,
    useAccountAssetBalanceQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    type PeraAsset,
    useSingleAssetDetailsQuery,
} from '@perawallet/wallet-core-assets'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { ExpandablePanel } from '@components/ExpandablePanel'

export type AssetHoldingsProps = {
    account: WalletAccount
    asset: PeraAsset
    onSwipeEnabledChange?: (enabled: boolean) => void
    isCollectible?: boolean
}

export const AssetHoldings = ({
    account,
    asset,
    onSwipeEnabledChange,
    isCollectible,
}: AssetHoldingsProps) => {
    const styles = useStyles()
    const { data: assetDetails } = useSingleAssetDetailsQuery(asset.assetId)
    const { preferredCurrency } = useCurrency()
    const { period, setPeriod, selectedPoint, setSelectedPoint } =
        useChartInteraction<AccountBalanceHistoryItem>()

    useEffect(() => {
        onSwipeEnabledChange?.(!selectedPoint)
    }, [selectedPoint, onSwipeEnabledChange])

    const { getPreference } = usePreferences()
    const chartVisible = !!getPreference(UserPreferences.chartVisible)

    const { data: assetHolding } = useAccountAssetBalanceQuery(
        account,
        asset.assetId,
    )

    const cryptoAmount = useMemo(() => {
        const currentCrypto = selectedPoint
            ? selectedPoint.algoValue
            : (assetHolding?.amount ?? new Decimal(0))
        return currentCrypto
    }, [assetHolding, selectedPoint])

    const selectedPreferredValue = useMemo(() => {
        if (!selectedPoint) return null
        return selectedPoint.preferredValue ?? new Decimal(0)
    }, [selectedPoint])

    return (
        <AssetTransactionList
            account={account}
            asset={asset}
        >
            <PWView style={styles.contentContainer}>
                <PWView style={styles.header}>
                    <PWView style={styles.assetRow}>
                        <AssetTitle asset={asset} />
                        <PWView style={styles.headerIcons}>
                            <AssetNotificationButton
                                assetId={asset.assetId}
                                isNotificationsEnabled={
                                    assetDetails?.peraMetadata
                                        ?.isPriceAlertEnabled
                                }
                            />
                            <AssetFavoriteButton
                                assetId={asset.assetId}
                                isFavorite={
                                    assetDetails?.peraMetadata?.isFavorited
                                }
                            />
                        </PWView>
                    </PWView>

                    <PWView style={styles.primaryValueContainer}>
                        <CurrencyDisplay
                            variant='h1'
                            value={cryptoAmount}
                            currency={asset.unitName ?? ''}
                            precision={asset.decimals}
                            minPrecision={2}
                        />
                    </PWView>

                    <PWView style={styles.secondaryValueContainer}>
                        {selectedPoint ? (
                            <CurrencyDisplay
                                value={selectedPreferredValue}
                                currency={preferredCurrency}
                                precision={2}
                                minPrecision={2}
                            />
                        ) : (
                            <PreferredCurrencyDisplay
                                sourceAmount={
                                    assetHolding?.amount ?? new Decimal(0)
                                }
                                sourceAssetId={asset.assetId}
                                precision={2}
                                minPrecision={2}
                            />
                        )}
                        {!!selectedPoint && (
                            <PWText>
                                {formatDatetime(selectedPoint.datetime)}
                            </PWText>
                        )}
                    </PWView>
                </PWView>

                <ExpandablePanel isExpanded={chartVisible}>
                    <PWView style={styles.chartContainer}>
                        <AssetWealthChart
                            account={account}
                            asset={asset}
                            period={period}
                            onSelectionChanged={setSelectedPoint}
                        />
                        <ChartPeriodSelection
                            value={period}
                            onChange={setPeriod}
                        />
                    </PWView>
                </ExpandablePanel>

                <AssetActionButtons
                    asset={asset}
                    assetHolding={assetHolding}
                    isCollectible={isCollectible}
                />
            </PWView>
        </AssetTransactionList>
    )
}
