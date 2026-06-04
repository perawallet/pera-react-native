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
import { formatDatetime, type Nullable } from '@perawallet/wallet-core-shared'
import { percentChange } from '@perawallet/wallet-core-blockchain'
import { trackEvent, HomeEvent } from '@perawallet/wallet-core-analytics'
import { useCallback, useMemo } from 'react'
import { useChartInteraction } from '@hooks/useChartInteraction'
import { ChartPeriodSelection } from '@components/ChartPeriodSelection'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    AccountBalanceHistoryItem,
    useAccountBalancesQuery,
    useAccountBalancesHistoryQuery,
    usePortfolioTotals,
    useSigningAccounts,
} from '@perawallet/wallet-core-accounts'
import { Decimal } from 'decimal.js'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { InfoButton } from '@components/InfoButton'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { TrendIndicator } from '@components/TrendIndicator'

export type PortfolioViewProps = {
    onDataSelected?: (selected: Nullable<AccountBalanceHistoryItem>) => void
    /** Transiently collapses the chart without touching the saved `chartVisible` preference. */
    isCollapsed?: boolean
    onExpandChart?: () => void
} & PWViewProps

export const PortfolioView = ({
    isCollapsed = false,
    onExpandChart,
    ...props
}: PortfolioViewProps) => {
    const styles = useStyles()
    const { preferredCurrency, usdToPreferred } = useCurrency()
    const { t } = useLanguage()

    const accounts = useSigningAccounts()
    const { portfolioAlgoValue, accountBalances, isPending } =
        useAccountBalancesQuery(accounts)
    const { portfolioUsdValue } = usePortfolioTotals(accountBalances)
    const portfolioPreferredValue = useMemo(() => {
        return usdToPreferred(portfolioUsdValue)
    }, [portfolioUsdValue, usdToPreferred])
    const { period, setPeriod, selectedPoint, setSelectedPoint } =
        useChartInteraction<AccountBalanceHistoryItem>()
    const { getPreference, setPreference } = usePreferences()

    const chartVisible = !!getPreference(UserPreferences.chartVisible)
    const isChartShown = chartVisible && !isCollapsed
    const toggleChartVisible = () => {
        trackEvent(HomeEvent.Chart)
        if (isChartShown) {
            setPreference(UserPreferences.chartVisible, false)
            return
        }
        setPreference(UserPreferences.chartVisible, true)
        onExpandChart?.()
    }

    const addresses = useMemo(() => accounts.map(a => a.address), [accounts])

    const { data: historyData } = useAccountBalancesHistoryQuery(
        addresses,
        period,
    )

    const historyDataPoints = useMemo(
        () => historyData?.map(p => p.preferredValue) ?? [],
        [historyData],
    )

    const [trendAbsolute, trendPercentage] = useMemo(() => {
        const firstDp = historyDataPoints.at(0) ?? new Decimal(0)
        const lastDp = historyDataPoints.at(-1) ?? new Decimal(0)

        return [lastDp.minus(firstDp), percentChange(firstDp, lastDp)]
    }, [historyDataPoints])

    const chartSelectionChanged = useCallback(
        (selected: Nullable<AccountBalanceHistoryItem>) => {
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
                        <PWView style={styles.titleTextContainer}>
                            <PWText
                                style={styles.valueTitle}
                                variant='h4'
                                truncate
                            >
                                {t('portfolio.title')}
                            </PWText>
                        </PWView>
                        <PWView style={styles.infoButtonContainer}>
                            <InfoButton
                                variant='secondary'
                                title={t('portfolio.info.title')}
                            >
                                <PWText>{t('portfolio.info.body')}</PWText>
                            </InfoButton>
                        </PWView>
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
                                ? selectedPoint.preferredValue
                                : portfolioPreferredValue
                        }
                        currency={preferredCurrency}
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
                            truncate
                        >
                            {t('portfolio.last_7_days')}
                        </PWText>

                        <TrendIndicator
                            percentage={trendPercentage}
                            variant='h2'
                            hasNeutralText
                            shouldHideIconWhenZero
                            absolute={{
                                amount: trendAbsolute,
                                currency: preferredCurrency,
                            }}
                        />
                    </PWView>
                )}

                {selectedPoint && (
                    <PWView style={styles.dateTimeColumn}>
                        <PWText
                            variant='h4'
                            style={styles.dateDisplay}
                        >
                            {formatDatetime(
                                selectedPoint.datetime,
                                undefined,
                                'long',
                                'date',
                            )}
                        </PWText>
                        <PWText
                            variant='h4'
                            style={styles.dateDisplay}
                        >
                            {formatDatetime(
                                selectedPoint.datetime,
                                undefined,
                                'long',
                                'time',
                            )}
                        </PWText>
                    </PWView>
                )}
            </PWView>

            <PWDivider style={styles.divider} />

            <PWTouchableOpacity
                style={styles.chartToggle}
                onPress={toggleChartVisible}
            >
                <PWText
                    style={styles.chartToggleText}
                    truncate
                >
                    {isChartShown
                        ? t('portfolio.hide_chart')
                        : t('portfolio.show_chart')}
                </PWText>
                <PWIcon
                    name='chevron-down'
                    variant='secondary'
                    size='xs'
                    style={isChartShown ? styles.invertedIcon : undefined}
                />
            </PWTouchableOpacity>

            <ExpandablePanel isExpanded={isChartShown}>
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
