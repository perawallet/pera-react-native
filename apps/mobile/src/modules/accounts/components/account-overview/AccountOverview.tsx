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

import PWView from '@components/view/PWView'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import CurrencyDisplay from '@components/currency-display/CurrencyDisplay'
import Decimal from 'decimal.js'
import WealthChart from '@components/wealth-chart/WealthChart'
import ButtonPanel from '../button-panel/ButtonPanel'
import AccountAssetList from '../asset-list/AccountAssetList'
import { Text } from '@rneui/themed'
import { useCallback, useState } from 'react'
import { useChartInteraction } from '@hooks/chart-interaction'
import { useStyles } from './styles'
import PWTouchableOpacity from '@components/touchable-opacity/PWTouchableOpacity'
import WealthTrend from '@components/wealth-trend/WealthTrend'
import ChartPeriodSelection from '@components/chart-period-selection/ChartPeriodSelection'
import {
    AccountBalanceHistoryItem,
    useAccountBalancesQuery,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { usePreferences, useSettings } from '@perawallet/wallet-core-settings'
import PWButton from '@components/button/PWButton'
import { UserPreferences } from '@constants/user-preferences'
import ExpandablePanel from '@components/expandable-panel/ExpandablePanel'

type AccountOverviewProps = {
    account: WalletAccount
}

//TODO implement min balance display and info icon
//TODO layout and spacing needs a bit of clean up
const AccountOverview = ({ account }: AccountOverviewProps) => {
    const { preferredCurrency } = useCurrency()
    const styles = useStyles()

    const { portfolioAlgoValue, portfolioFiatValue, isPending } =
        useAccountBalancesQuery(account ? [account] : [])
    const { getPreference, setPreference } = usePreferences()

    const { period, setPeriod, selectedPoint, setSelectedPoint } =
        useChartInteraction<AccountBalanceHistoryItem>()
    const [scrollingEnabled, setScrollingEnabled] = useState<boolean>(true)
    const { privacyMode, setPrivacyMode } = useSettings()

    const togglePrivacyMode = () => {
        setPrivacyMode(!privacyMode)
    }

    const chartVisible = !!getPreference(UserPreferences.chartVisible)
    const toggleChartVisible = useCallback(() => {
        setPreference(UserPreferences.chartVisible, !chartVisible)
    }, [chartVisible, setPreference])

    const chartSelectionChanged = useCallback(
        (selected: AccountBalanceHistoryItem | null) => {
            setSelectedPoint(selected)

            if (selected) {
                setScrollingEnabled(false)
            } else {
                setScrollingEnabled(true)
            }
        },
        [setSelectedPoint],
    )

    return (
        <AccountAssetList
            account={account}
            scrollEnabled={scrollingEnabled}
        >
            <PWTouchableOpacity
                onPress={togglePrivacyMode}
                style={styles.valueBarContainer}
            >
                <PWView style={styles.valueBar}>
                    <CurrencyDisplay
                        h1
                        value={
                            selectedPoint
                                ? Decimal(selectedPoint.algoValue)
                                : portfolioAlgoValue
                        }
                        currency='ALGO'
                        precision={2}
                        h1Style={styles.primaryCurrency}
                        skeleton={isPending}
                    />
                    <PWButton
                        icon='chart'
                        variant={chartVisible ? 'secondary' : 'helper'}
                        paddingStyle='dense'
                        onPress={toggleChartVisible}
                    />
                </PWView>
                <PWView style={styles.secondaryValueBar}>
                    <CurrencyDisplay
                        h4
                        h4Style={styles.valueTitle}
                        value={
                            selectedPoint
                                ? Decimal(selectedPoint.fiatValue)
                                : portfolioFiatValue
                        }
                        currency={preferredCurrency}
                        prefix='≈ '
                        precision={2}
                        skeleton={isPending}
                    />
                    {!selectedPoint && (
                        <WealthTrend
                            account={account}
                            period={period}
                        />
                    )}
                    {selectedPoint && (
                        <Text
                            h4
                            h4Style={styles.dateDisplay}
                        >
                            {formatDatetime(selectedPoint.datetime)}
                        </Text>
                    )}
                </PWView>
            </PWTouchableOpacity>

            <ExpandablePanel expanded={chartVisible} containerStyle={styles.chartContainer}>
                <WealthChart
                    account={account}
                    period={period}
                    onSelectionChanged={chartSelectionChanged}
                />
                <ChartPeriodSelection
                    value={period}
                    onChange={setPeriod}
                />
            </ExpandablePanel>

            <ButtonPanel />
        </AccountAssetList>
    )
}

export default AccountOverview
