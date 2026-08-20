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

import {
    PWDivider,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
    type PWViewProps,
} from '@components/core'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'

import { AssetAmount } from '@components/AssetAmount'
import { PreferredAmount } from '@components/PreferredAmount'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { WealthChart } from '@components/WealthChart'
import {
    formatDatetime,
    type HistoryPeriod,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { percentChange } from '@perawallet/wallet-core-blockchain'
import { trackEvent, HomeEvent } from '@analytics'
import { useCallback, useMemo } from 'react'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import {
    EXPANDABLE_PANEL_ANIMATION_DURATION,
    EXPANDABLE_PANEL_ANIMATION_EASING,
} from '@constants/ui'
import { useChartInteraction } from '@hooks/useChartInteraction'
import { ChartPeriodSelection } from '@components/ChartPeriodSelection'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import {
    type AccountBalanceHistoryItem,
    useAccountValueTotalsQuery,
    useAccountBalancesHistoryQuery,
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
} & PWViewProps

export const PortfolioView = ({ ...props }: PortfolioViewProps) => {
    const styles = useStyles()
    const { preferredCurrency, usdToPreferred } = useCurrency()
    const { t } = useLanguage()

    const accounts = useSigningAccounts()
    const { portfolioAlgoValue, portfolioUsdValue, isPending } =
        useAccountValueTotalsQuery(accounts)
    const portfolioPreferredValue = useMemo(() => {
        return usdToPreferred(portfolioUsdValue)
    }, [portfolioUsdValue, usdToPreferred])
    const { period, setPeriod, selectedPoint, setSelectedPoint } =
        useChartInteraction<AccountBalanceHistoryItem>()
    const { getPreference, setPreference } = usePreferences()

    const isChartShown = !!getPreference(UserPreferences.chartVisible)
    const toggleChartVisible = () => {
        trackEvent(HomeEvent.Chart)
        setPreference(UserPreferences.chartVisible, !isChartShown)
    }

    const addresses = useMemo(() => accounts.map(a => a.address), [accounts])

    const { data: historyData } = useAccountBalancesHistoryQuery(
        addresses,
        period,
        isChartShown,
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

    const trendPeriodLabel = useMemo<Record<HistoryPeriod, string>>(
        () => ({
            'one-day': t('portfolio.last_24_hours'),
            'one-week': t('portfolio.last_7_days'),
            'one-month': t('portfolio.last_30_days'),
            'one-year': t('portfolio.last_year'),
        }),
        [t],
    )

    const chartSelectionChanged = useCallback(
        (selected: Nullable<AccountBalanceHistoryItem>) => {
            setSelectedPoint(selected)
            props.onDataSelected?.(selected)
        },
        [setSelectedPoint, props],
    )

    // Timed to the ExpandablePanel below so the trend column and the toggle
    // chevron move together with the chart instead of popping instantly.
    const trendColumnStyle = useAnimatedStyle(
        () => ({
            opacity: withTiming(isChartShown ? 1 : 0, {
                duration: EXPANDABLE_PANEL_ANIMATION_DURATION,
                easing: EXPANDABLE_PANEL_ANIMATION_EASING,
            }),
        }),
        [isChartShown],
    )
    const chevronStyle = useAnimatedStyle(
        () => ({
            transform: [
                {
                    rotate: withTiming(isChartShown ? '180deg' : '0deg', {
                        duration: EXPANDABLE_PANEL_ANIMATION_DURATION,
                        easing: EXPANDABLE_PANEL_ANIMATION_EASING,
                    }),
                },
            ],
        }),
        [isChartShown],
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
                    <AssetAmount
                        variant='h2'
                        value={
                            selectedPoint
                                ? selectedPoint.algoValue
                                : portfolioAlgoValue
                        }
                        asset={ALGO_ASSET}
                        density='compact'
                        style={styles.primaryCurrency}
                        isLoading={isPending}
                    />
                    <PreferredAmount
                        variant='h4'
                        style={styles.valueTitle}
                        value={
                            selectedPoint
                                ? selectedPoint.preferredValue
                                : portfolioPreferredValue
                        }
                        prefix='≈ '
                        density='compact'
                        isLoading={isPending}
                    />
                </PWView>

                {/* Stays mounted while the chart is hidden so it can fade in
                    sync with the panel collapse rather than unmount abruptly. */}
                {!selectedPoint && (
                    <Animated.View
                        style={[styles.rightColumn, trendColumnStyle]}
                        accessibilityElementsHidden={!isChartShown}
                        importantForAccessibility={
                            isChartShown ? 'auto' : 'no-hide-descendants'
                        }
                    >
                        <PWText
                            variant='h4'
                            style={styles.trendTitle}
                            truncate
                        >
                            {trendPeriodLabel[period]}
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
                    </Animated.View>
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
                <Animated.View style={chevronStyle}>
                    <PWIcon
                        name='chevron-down'
                        variant='secondary'
                        size='xs'
                    />
                </Animated.View>
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
