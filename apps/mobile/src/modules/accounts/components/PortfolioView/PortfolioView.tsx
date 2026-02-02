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
    PWDivider,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
    PWViewProps,
} from '@components/core'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'

import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { WealthChart } from '@components/WealthChart'
import { formatDatetime, formatCurrency } from '@perawallet/wallet-core-shared'
import { useCallback, useMemo } from 'react'
import { useChartInteraction } from '@hooks/useChartInteraction'
import { ChartPeriodSelection } from '@components/ChartPeriodSelection'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    AccountBalanceHistoryItem,
    useAccountBalancesQuery,
    useAccountBalancesHistoryQuery,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import Decimal from 'decimal.js'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { InfoButton } from '@components/InfoButton'
import { ExpandablePanel } from '@components/ExpandablePanel'

export type PortfolioViewProps = {
    onDataSelected?: (selected: AccountBalanceHistoryItem | null) => void
} & PWViewProps

export const PortfolioView = (props: PortfolioViewProps) => {
    const styles = useStyles()
    const { preferredFiatCurrency } = useCurrency()
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

    const addresses = useMemo(() => accounts.map(a => a.address), [accounts])

    const { data: historyData } = useAccountBalancesHistoryQuery(
        addresses,
        period,
    )

    const historyDataPoints = useMemo(
        () => historyData?.map(p => p.fiatValue) ?? [],
        [historyData],
    )

    const [trendAbsolute, trendPercentage, isPositiveTrend] = useMemo(() => {
        const firstDp = historyDataPoints.at(0) ?? Decimal(0)
        const lastDp = historyDataPoints.at(-1) ?? Decimal(0)

        return [
            lastDp.minus(firstDp),
            lastDp.isZero()
                ? Decimal(0)
                : lastDp.minus(firstDp).abs().div(lastDp).mul(100),
            lastDp.greaterThanOrEqualTo(firstDp),
        ]
    }, [historyDataPoints])

    const chartSelectionChanged = useCallback(
        (selected: AccountBalanceHistoryItem | null) => {
            setSelectedPoint(selected)
            props.onDataSelected?.(selected)
        },
        [setSelectedPoint, props],
    )

    return (
        <PWView
            {...props}
            style={[styles.container, props.style]}
        >
            <PWView style={styles.columns}>
                <PWView style={styles.leftColumn}>
                    <PWView style={styles.valueTitleBar}>
                        <PWText
                            style={styles.valueTitle}
                            variant='h4'
                        >
                            {t('portfolio.title')}
                        </PWText>
                        <InfoButton
                            variant='secondary'
                            title={t('portfolio.info.title')}
                        >
                            <PWText>{t('portfolio.info.body')}</PWText>
                        </InfoButton>
                    </PWView>
                    <CurrencyDisplay
                        variant='h2'
                        value={
                            selectedPoint
                                ? selectedPoint.algoValue
                                : portfolioAlgoValue
                        }
                        currency='ALGO'
                        precision={2}
                        style={styles.primaryCurrency}
                        isLoading={isPending}
                    />
                    <CurrencyDisplay
                        variant='h4'
                        style={styles.valueTitle}
                        value={
                            selectedPoint
                                ? selectedPoint.fiatValue
                                : portfolioFiatValue
                        }
                        currency={preferredFiatCurrency}
                        prefix='≈ '
                        precision={2}
                        isLoading={isPending}
                    />
                </PWView>

                {!selectedPoint && (
                    <PWView style={styles.rightColumn}>
                        <PWText
                            variant='h4'
                            style={styles.trendTitle}
                        >
                            {t('portfolio.last_7_days')}
                        </PWText>

                        <PWView style={styles.trendContent}>
                            {!trendPercentage.isZero() && (
                                <PWView style={styles.trendIconContainer}>
                                    <PWIcon
                                        name={
                                            isPositiveTrend
                                                ? 'arrow-up'
                                                : 'arrow-down'
                                        }
                                        variant={
                                            isPositiveTrend ? 'helper' : 'error'
                                        }
                                        size='sm'
                                    />
                                </PWView>
                            )}
                            <PWText
                                variant='h2'
                                style={styles.primaryCurrency}
                            >
                                {trendPercentage.toFixed(2)}%
                            </PWText>
                        </PWView>

                        <PWText
                            variant='h4'
                            style={styles.valueTitle}
                        >
                            {isPositiveTrend ? '+' : '-'}
                            {formatCurrency(
                                trendAbsolute.abs(),
                                2,
                                preferredFiatCurrency,
                                undefined,
                                true,
                            )}
                        </PWText>
                    </PWView>
                )}

                {selectedPoint && (
                    <PWView style={styles.rightColumn}>
                        <PWText
                            variant='h4'
                            style={styles.dateDisplay}
                        >
                            {formatDatetime(selectedPoint.datetime)}
                        </PWText>
                    </PWView>
                )}
            </PWView>

            <PWDivider style={styles.divider} />

            <PWTouchableOpacity
                style={styles.chartToggle}
                onPress={toggleChartVisible}
            >
                <PWText style={styles.chartToggleText}>
                    {chartVisible
                        ? t('portfolio.hide_chart')
                        : t('portfolio.show_chart')}
                </PWText>
                <PWIcon
                    name='chevron-down'
                    variant='secondary'
                    size='xs'
                    style={chartVisible ? styles.invertedIcon : undefined}
                />
            </PWTouchableOpacity>

            <ExpandablePanel isExpanded={chartVisible}>
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
            </ExpandablePanel>
        </PWView>
    )
}
