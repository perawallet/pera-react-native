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

import { formatDatetime, HistoryPeriod } from '@perawallet/wallet-core-shared'
import PWView from '@components/view/PWView'
import AssetWealthChart from './asset-wealth-chart/AssetWealthChart'
import ChartPeriodSelection from '@components/chart-period-selection/ChartPeriodSelection'
import { useState, useMemo } from 'react'
import AssetActionButtons from './asset-action-buttons/AssetActionButtons'
import AssetTransactionList from './asset-transaction-list/AssetTransactionList'

import { useStyles } from './styles'
import AssetTitle from '@modules/assets/components/asset-title/AssetTitle'
import CurrencyDisplay from '@components/currency-display/CurrencyDisplay'
import Decimal from 'decimal.js'
import RoundButton from '@components/round-button/RoundButton'
import { Text } from '@rneui/themed'
import {
    AccountBalanceHistoryItem,
    useAccountAssetBalanceQuery,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { PeraAsset } from '@perawallet/wallet-core-assets'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import PWButton from '@components/button/PWButton'

type AssetHoldingsProps = {
    account: WalletAccount
    asset: PeraAsset
}

const AssetHoldings = ({ account, asset }: AssetHoldingsProps) => {
    const styles = useStyles()
    const { preferredCurrency } = useCurrency()
    const [period, setPeriod] = useState<HistoryPeriod>('one-week')
    const [selectedPoint, setSelectedPoint] =
        useState<AccountBalanceHistoryItem | null>(null)

    const { getPreference, setPreference } = usePreferences()
    const chartVisible = !!getPreference(UserPreferences.chartVisible)
    const toggleChartVisible = () => {
        setPreference(UserPreferences.chartVisible, !chartVisible)
    }

    const { data: assetHolding } = useAccountAssetBalanceQuery(
        account,
        asset.assetId,
    )

    const cryptoAmount = useMemo(() => {
        const currentCrypto = selectedPoint
            ? selectedPoint.algoValue
            : (assetHolding?.amount ?? Decimal(0))
        return currentCrypto
    }, [assetHolding, selectedPoint])

    const fiatAmount = useMemo(() => {
        const currentUSD = selectedPoint
            ? (selectedPoint.fiatValue ?? Decimal(0))
            : (assetHolding?.fiatValue ?? Decimal(0))
        return currentUSD
    }, [assetHolding, selectedPoint])

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
                            <RoundButton
                                icon='bell'
                                size='sm'
                                variant='secondary'
                            />
                            <RoundButton
                                icon='star'
                                size='sm'
                                variant='secondary'
                            />
                        </PWView>
                    </PWView>

                    <PWView style={styles.primaryValueContainer}>
                        <CurrencyDisplay
                            h1
                            value={cryptoAmount}
                            currency={asset.unitName ?? ''}
                            precision={asset.decimals}
                            minPrecision={2}
                        />
                        <PWButton
                            icon='chart'
                            variant={chartVisible ? 'secondary' : 'helper'}
                            paddingStyle='dense'
                            onPress={toggleChartVisible}
                        />
                    </PWView>

                    <PWView style={styles.secondaryValueContainer}>
                        <CurrencyDisplay
                            value={fiatAmount}
                            currency={preferredCurrency}
                            precision={2}
                            minPrecision={2}
                        />
                        {!!selectedPoint && (
                            <Text>
                                {formatDatetime(selectedPoint.datetime)}
                            </Text>
                        )}
                    </PWView>
                </PWView>

                {chartVisible && (
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
                )}

                <AssetActionButtons asset={asset} />
            </PWView>
        </AssetTransactionList>
    )
}

export default AssetHoldings
