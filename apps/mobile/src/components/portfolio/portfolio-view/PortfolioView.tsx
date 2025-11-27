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

import PWView from '../../common/view/PWView'
import CurrencyDisplay from '../../currency/currency-display/CurrencyDisplay'
import WealthChart from '../../common/wealth-chart/WealthChart'
import { PWViewProps } from '../../common/view/PWView'
import PWTouchableOpacity from '../../common/touchable-opacity/PWTouchableOpacity'
import { formatDatetime, HistoryPeriod } from '@perawallet/wallet-core-shared'
import { useCallback, useState } from 'react'
import PWIcon from '../../common/icons/PWIcon'
import WealthTrend from '../../common/wealth-trend/WealthTrend'
import ChartPeriodSelection from '../../common/chart-period-selection/ChartPeriodSelection'
import PWButton from '../../common/button/PWButton'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    AccountBalanceHistoryItem,
    useAccountBalancesQuery,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'

type PortfolioViewProps = {
    onDataSelected?: (selected: AccountBalanceHistoryItem | null) => void
} & PWViewProps

//TODO layout and spacing needs a bit of clean up
const PortfolioView = (props: PortfolioViewProps) => {
    const styles = useStyles()
    const { preferredCurrency } = useCurrency()

    const accounts = useAllAccounts()
    const { portfolioAlgoValue, portfolioFiatValue, isPending } =
        useAccountBalancesQuery(accounts)
    const [period, setPeriod] = useState<HistoryPeriod>('one-week')
    const [chartData, setChartData] =
        useState<AccountBalanceHistoryItem | null>(null)
    const [chartVisible, setChartVisible] = useState<boolean>(false)

    const toggleChartVisible = () => {
        setChartVisible(!chartVisible)
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
                    Portfolio Value
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
                    value={
                        chartData ? chartData.algoValue : portfolioAlgoValue
                    }
                    currency='ALGO'
                    precision={2}
                    h1Style={styles.primaryCurrency}
                    skeleton={isPending}
                />
                <PWButton
                    title={chartVisible ? 'Hide Chart' : 'Show Chart'}
                    variant='helper'
                    paddingStyle='dense'
                    onPress={toggleChartVisible}
                />
            </PWView>
            <PWView style={styles.secondaryValueBar}>
                <CurrencyDisplay
                    h4
                    h4Style={styles.valueTitle}
                    value={
                        chartData ? chartData.fiatValue : portfolioFiatValue
                    }
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
                <>
                    <WealthChart
                        period={period}
                        onSelectionChanged={chartSelectionChanged}
                    />
                    <ChartPeriodSelection
                        value={period}
                        onChange={setPeriod}
                    />
                </>
            )}
        </PWView>
    )
}

export default PortfolioView
