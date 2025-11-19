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

import {
    PeraAsset,
    WalletAccount,
    useAccountBalances,
    useCurrencyConverter,
    AccountWealthHistoryItem,
} from '@perawallet/core'
import PWView from '../../common/view/PWView'
import AssetWealthChart from './asset-wealth-chart/AssetWealthChart'
import ChartPeriodSelection, {
    ChartPeriod,
    ChartPeriods,
} from '../../common/chart-period-selection/ChartPeriodSelection'
import { useState, useMemo } from 'react'
import AssetActionButtons from './asset-action-buttons/AssetActionButtons'
import AssetTransactionList from './asset-transaction-list/AssetTransactionList'
import { ScrollView } from 'react-native'
import { useStyles } from './styles'
import AssetTitle from '../../assets/asset-title/AssetTitle'
import CurrencyDisplay from '../../currency/currency-display/CurrencyDisplay'
import Decimal from 'decimal.js'
import PWIcon from '../../common/icons/PWIcon'

type AssetHoldingsProps = {
    account: WalletAccount
    asset: PeraAsset
}

const AssetHoldings = ({ account, asset }: AssetHoldingsProps) => {
    const styles = useStyles()
    const { preferredCurrency, convertUSDToPreferredCurrency } =
        useCurrencyConverter()
    const [period, setPeriod] = useState<ChartPeriod>(ChartPeriods.OneWeek)
    const [selectedPoint, setSelectedPoint] =
        useState<AccountWealthHistoryItem | null>(null)

    const { data } = useAccountBalances([account])
    const accountData = data[0]

    const assetHolding = useMemo(() => {
        return accountData?.accountInfo?.results?.find(
            (a: any) => a.asset_id === asset.assetId,
        )
    }, [accountData, asset.assetId])

    const cryptoAmount = useMemo(() => {
        const currentCrypto = selectedPoint
            ? selectedPoint.algo_value
            : (assetHolding?.amount ?? 0)
        return Decimal(currentCrypto)
    }, [assetHolding, selectedPoint])

    const fiatAmount = useMemo(() => {
        const currentUSD = selectedPoint
            ? Decimal(selectedPoint.value_in_currency ?? 0)
            : convertUSDToPreferredCurrency(
                Decimal(assetHolding?.balance_usd_value ?? 0),
            )
        return currentUSD
    }, [assetHolding, selectedPoint, convertUSDToPreferredCurrency])

    if (!asset) {
        return <></>
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
        >
            <PWView style={styles.header}>
                <PWView style={styles.assetRow}>
                    <AssetTitle asset={asset} />
                    <PWView style={styles.headerIcons}>
                        <PWIcon
                            name='bell'
                            size='sm'
                            variant='secondary'
                        />
                        <PWIcon
                            name='star'
                            size='sm'
                            variant='secondary'
                        />
                    </PWView>
                </PWView>

                <CurrencyDisplay
                    h1
                    value={cryptoAmount}
                    currency={asset.unit_name}
                    precision={asset.fraction_decimals}
                />
                <CurrencyDisplay
                    value={fiatAmount}
                    currency={preferredCurrency}
                    precision={2}
                />
            </PWView>

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

            <AssetActionButtons />

            <AssetTransactionList
                account={account}
                asset={asset}
            />
        </ScrollView>
    )
}

export default AssetHoldings
