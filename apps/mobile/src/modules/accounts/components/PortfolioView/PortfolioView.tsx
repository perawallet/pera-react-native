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
    PWBadge,
    PWDivider,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
    type PWViewProps,
} from '@components/core'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'

import { PreferredAmount } from '@components/PreferredAmount'
import { WealthChart } from '@components/WealthChart'
import { formatDatetime, type Nullable } from '@perawallet/wallet-core-shared'
import { trackEvent, HomeEvent } from '@analytics'
import { useCallback } from 'react'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import {
    EXPANDABLE_PANEL_ANIMATION_DURATION,
    EXPANDABLE_PANEL_ANIMATION_EASING,
} from '@constants/ui'
import { useChartInteraction } from '@hooks/useChartInteraction'
import { ChartPeriodSelection } from '@components/ChartPeriodSelection'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import type { PortfolioValueHistoryItem } from '@perawallet/wallet-core-accounts'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { InfoButton } from '@components/InfoButton'
import { usePortfolioChange } from './usePortfolioChange'
import { usePortfolioView } from './usePortfolioView'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { ValueChangeLine } from '@components/ValueChangeLine'

export type PortfolioViewProps = {
    onDataSelected?: (selected: Nullable<PortfolioValueHistoryItem>) => void
} & PWViewProps

export const PortfolioView = ({ ...props }: PortfolioViewProps) => {
    const {
        scope,
        portfolioPreferredValue,
        isPreferredValuePartial,
        hasFiatTotal,
        chartSources,
        hasBalanceHistory,
        isPending,
        isDrawerOpen,
    } = usePortfolioView()
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

    const { changeAbsolute, changePercentage, hasChange } = usePortfolioChange({
        chartSources,
        scope,
        chartPeriod: period,
        isChartShown,
        isEnabled: hasFiatTotal && hasBalanceHistory && isDrawerOpen,
    })

    const chartSelectionChanged = useCallback(
        (selected: Nullable<PortfolioValueHistoryItem>) => {
            setSelectedPoint(selected)
            props.onDataSelected?.(selected)
        },
        [setSelectedPoint, props],
    )

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
                    {hasFiatTotal ? (
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
                        // Test-network value never counts as money, so a fiat
                        // total here would read as an empty wallet.
                        <PWBadge
                            variant='testnet'
                            value={t('common.network_label.testnet')}
                        />
                    )}
                    {hasChange && !selectedPoint && (
                        <ValueChangeLine
                            testID='portfolio_change_line'
                            absolute={changeAbsolute}
                            percentage={changePercentage}
                            currency={preferredCurrency}
                        />
                    )}
                </PWView>

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
                    <ExpandablePanel isExpanded={isChartShown}>
                        <PWView style={styles.chartContainer}>
                            <WealthChart
                                sources={chartSources}
                                currencyScope={scope}
                                period={period}
                                enabled={isChartShown && isDrawerOpen}
                                onSelectionChanged={chartSelectionChanged}
                            />
                            <ChartPeriodSelection
                                value={period}
                                onChange={setPeriod}
                            />
                        </PWView>
                    </ExpandablePanel>

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
                </>
            )}
        </PWView>
    )
}
