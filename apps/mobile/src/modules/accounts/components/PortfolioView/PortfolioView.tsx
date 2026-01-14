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

import PWView, { PWViewProps } from '@components/PWView'
import CurrencyDisplay from '@components/CurrencyDisplay'
import WealthChart from '@components/WealthChart'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import { useCallback } from 'react'
import { useChartInteraction } from '@hooks/chart-interaction'
import WealthTrend from '@components/WealthTrend'
import ChartPeriodSelection from '@components/ChartPeriodSelection'
import PWButton from '@components/PWButton'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    AccountBalanceHistoryItem,
    useAccountBalancesQuery,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import InfoButton from '@components/InfoButton'
import ExpandablePanel from '@components/ExpandablePanel'

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
    const { period, setPeriod, selectedPoint, setSelectedPoint } =
        useChartInteraction<AccountBalanceHistoryItem>()
    const { getPreference, setPreference } = usePreferences()

    const chartVisible = !!getPreference(UserPreferences.chartVisible)
    const toggleChartVisible = () => {
        setPreference(UserPreferences.chartVisible, !chartVisible)
    }

    const chartSelectionChanged = useCallback(
        (selected: AccountBalanceHistoryItem | null) => {
            setSelectedPoint(selected)
            props.onDataSelected?.(selected)
        },
        [setSelectedPoint, props],
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
                <InfoButton
                    variant='secondary'
                    title={t('portfolio.info.title')}
                >
                    <Text>{t('portfolio.info.body')}</Text>
                </InfoButton>
            </PWView>
            <PWView style={styles.valueBar}>
                <CurrencyDisplay
                    h1
                    value={
                        selectedPoint
                            ? selectedPoint.algoValue
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
                            ? selectedPoint.fiatValue
                            : portfolioFiatValue
                    }
                    currency={preferredCurrency}
                    prefix='≈ '
                    precision={2}
                    skeleton={isPending}
                />
                {!selectedPoint && <WealthTrend period={period} />}
                {selectedPoint && (
                    <Text
                        h4
                        h4Style={styles.dateDisplay}
                    >
                        {formatDatetime(selectedPoint.datetime)}
                    </Text>
                )}
            </PWView>

            <ExpandablePanel
                expanded={chartVisible}
                containerStyle={styles.chartContainer}
            >
                <WealthChart
                    period={period}
                    onSelectionChanged={chartSelectionChanged}
                />
                <ChartPeriodSelection
                    value={period}
                    onChange={setPeriod}
                />
            </ExpandablePanel>
        </PWView>
    )
}

export default PortfolioView
