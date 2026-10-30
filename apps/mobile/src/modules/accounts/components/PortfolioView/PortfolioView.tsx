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
import { useNativeAsset } from '@perawallet/wallet-core-assets'
import { WealthChart } from '@components/WealthChart'
import { formatDatetime, type Nullable } from '@perawallet/wallet-core-shared'
import { trackEvent, HomeEvent } from '@analytics'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import {
    EXPANDABLE_PANEL_ANIMATION_DURATION,
    EXPANDABLE_PANEL_ANIMATION_EASING,
} from '@constants/ui'
import { useChartInteraction } from '@hooks/useChartInteraction'
import { ChartPeriodSelection } from '@components/ChartPeriodSelection'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { type PortfolioValueHistoryItem } from '@perawallet/wallet-core-accounts'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { InfoButton } from '@components/InfoButton'
import { usePortfolioTrend } from './usePortfolioTrend'
import { usePortfolioTrendColumn } from './usePortfolioTrendColumn'
import { usePortfolioView } from './usePortfolioView'
import { usePortfolioChart } from './usePortfolioChart'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { TrendIndicator } from '@components/TrendIndicator'

export type PortfolioViewProps = {
    onDataSelected?: (selected: Nullable<PortfolioValueHistoryItem>) => void
} & PWViewProps

export const PortfolioView = ({ ...props }: PortfolioViewProps) => {
    const {
        scope,
        basis,
        portfolioNativeValue,
        portfolioPreferredValue,
        isPreferredValuePartial,
        hasFiatTotal,
        chartSources,
        hasBalanceHistory,
        isPending,
    } = usePortfolioView()
    const nativeAsset = useNativeAsset(scope)
    const styles = useStyles()
    const { preferredCurrency } = useCurrency(scope)
    const { t } = useLanguage()
    const { period, setPeriod, selectedPoint, setSelectedPoint } =
        useChartInteraction<PortfolioValueHistoryItem>()
    const { getPreference, setPreference } = usePreferences()

    const isChartShown =
        hasBalanceHistory && !!getPreference(UserPreferences.chartVisible)
    const toggleChartVisible = () => {
        trackEvent(HomeEvent.Chart)
        setPreference(UserPreferences.chartVisible, !isChartShown)
    }

    const { trendAbsolute, trendPercentage, hasNoTrend } = usePortfolioTrend(
        chartSources,
        period,
        scope,
        isChartShown,
    )

    const { selectedNativeValue, trendPeriodLabel, chartSelectionChanged } =
        usePortfolioChart({
            chartSources,
            period,
            scope,
            isChartShown,
            basis,
            selectedPoint,
            setSelectedPoint,
            onDataSelected: props.onDataSelected,
        })

    const { isTrendColumnInLayout, trendColumnStyle } =
        usePortfolioTrendColumn(isChartShown)
    // Timed to the ExpandablePanel below so the toggle chevron moves together
    // with the chart instead of popping instantly.
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
                                numberOfLines={2}
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
                    {basis === 'fiat' ? (
                        <>
                            <PreferredAmount
                                testID='portfolio_total_value'
                                variant='h2'
                                style={styles.primaryCurrency}
                                value={
                                    selectedPoint
                                        ? selectedPoint.preferredValue
                                        : portfolioPreferredValue
                                }
                                density='compact'
                                isLoading={isPending}
                            />
                            {isPreferredValuePartial && !selectedPoint && (
                                <PWText
                                    testID='portfolio_total_partial_notice'
                                    variant='caption'
                                    style={styles.partialNotice}
                                >
                                    {t('portfolio.partial_total')}
                                </PWText>
                            )}
                        </>
                    ) : (
                        <>
                            <AssetAmount
                                chainId={scope.chainId}
                                variant='h2'
                                value={
                                    selectedPoint
                                        ? selectedNativeValue
                                        : portfolioNativeValue
                                }
                                asset={nativeAsset}
                                density='compact'
                                style={styles.primaryCurrency}
                                isLoading={isPending}
                            />
                            {hasFiatTotal && (
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
                            )}
                        </>
                    )}
                </PWView>

                {/* Stays mounted while the chart is hidden so it can fade in
                    sync with the panel collapse rather than unmount abruptly. */}
                {hasFiatTotal &&
                    hasBalanceHistory &&
                    !selectedPoint &&
                    !hasNoTrend && (
                        <Animated.View
                            style={[
                                styles.rightColumn,
                                !isTrendColumnInLayout &&
                                    styles.rightColumnOverlay,
                                trendColumnStyle,
                            ]}
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
                            numberOfLines={1}
                        >
                            {formatDatetime(selectedPoint.datetime)}
                        </PWText>
                    </PWView>
                )}
            </PWView>

            {hasBalanceHistory && (
                <>
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
                                sources={chartSources}
                                currencyScope={scope}
                                period={period}
                                enabled={isChartShown}
                                onSelectionChanged={chartSelectionChanged}
                            />
                            <ChartPeriodSelection
                                value={period}
                                onChange={setPeriod}
                            />
                        </PWView>
                    </ExpandablePanel>
                </>
            )}
        </PWView>
    )
}
