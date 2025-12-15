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

import { Text } from '@rneui/themed'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/language'

import PWView, { PWViewProps } from '@components/view/PWView'
import CurrencyDisplay from '@components/currency-display/CurrencyDisplay'
import WealthChart from '@components/wealth-chart/WealthChart'
import PWTouchableOpacity from '@components/touchable-opacity/PWTouchableOpacity'
import { formatDatetime, HistoryPeriod } from '@perawallet/wallet-core-shared'
import { useCallback, useState } from 'react'
import PWIcon from '@components/icons/PWIcon'
import WealthTrend from '@components/wealth-trend/WealthTrend'
import ChartPeriodSelection from '@components/chart-period-selection/ChartPeriodSelection'
import PWButton from '@components/button/PWButton'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    AccountBalanceHistoryItem,
    useAccountBalancesQuery,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'

type PortfolioViewProps = {
    onDataSelected?: (selected: AccountBalanceHistoryItem | null) => void
} & PWViewProps

//TODO layout and spacing needs a bit of clean up
const PortfolioView = (props: PortfolioViewProps) => {
    const styles = useStyles()
    const { preferredCurrency } = useCurrency()
    const { t } = useLanguage()

    const accounts = useAllAccounts()
    const { portfolioAlgoValue, portfolioFiatValue, isPending } =
        useAccountBalancesQuery(accounts)
    const [period, setPeriod] = useState<HistoryPeriod>('one-week')
    const [chartData, setChartData] =
        useState<AccountBalanceHistoryItem | null>(null)
    const { getPreference, setPreference } = usePreferences()

    const chartVisible = !!getPreference(UserPreferences.chartVisible)
    const toggleChartVisible = () => {
        setPreference(UserPreferences.chartVisible, !chartVisible)
    }

    const chartSelectionChanged = useCallback(
        (selected: AccountBalanceHistoryItem | null) => {
            setChartData(selected)
            props.onDataSelected?.(selected)
        },
        [setChartData, props],
    )

    return (
        <PWView {...props}>
            <PWView style={styles.valueTitleBar}>
                <Text
                    h4Style={styles.valueTitle}
                    h4
                >
                    {t('portfolio.title')}
                </Text>
                <PWTouchableOpacity>
                    <PWIcon
                        name='info'
                        variant='secondary'
                    />
                </PWTouchableOpacity>
            </PWView>
            <PWView style={styles.valueBar}>
                <CurrencyDisplay
                    h1
                    value={chartData ? chartData.algoValue : portfolioAlgoValue}
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
                    value={chartData ? chartData.fiatValue : portfolioFiatValue}
                    currency={preferredCurrency}
                    prefix='≈ '
                    precision={2}
                    skeleton={isPending}
                />
                {!chartData && <WealthTrend period={period} />}
                {chartData && (
                    <Text
                        h4
                        h4Style={styles.dateDisplay}
                    >
                        {formatDatetime(chartData.datetime)}
                    </Text>
                )}
            </PWView>

            {chartVisible && (
                <PWView style={styles.chartContainer}>
                    <WealthChart
                        period={period}
                        onSelectionChanged={chartSelectionChanged}
                    />
                    <ChartPeriodSelection
                        value={period}
                        onChange={setPeriod}
                    />
                </PWView>
            )}
        </PWView>
    )
}

export default PortfolioView
