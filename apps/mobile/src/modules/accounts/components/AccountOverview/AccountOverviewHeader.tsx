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

import { useCallback } from 'react'
import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import {
    DEFAULT_PRECISION,
    formatDatetime,
} from '@perawallet/wallet-core-shared'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { Decimal } from 'decimal.js'
import { WealthChart } from '@components/WealthChart'
import { ButtonPanel } from '../ButtonPanel'
import { useStyles } from './styles'
import { WealthTrend } from '@components/WealthTrend'
import { ChartPeriodSelection } from '@components/ChartPeriodSelection'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'

import { useLanguage } from '@hooks/useLanguage'
import { NoFundsButtonPanel } from '../NoFundsButtonPanel'
import { WatchAccountButtonPanel } from '../WatchAccountButtonPanel'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { useAccountOverviewHeader } from './useAccountOverviewHeader'
import { AccountOverviewHeaderSkeleton } from './AccountOverviewHeaderSkeleton'

export type AccountOverviewHeaderProps = {
    account: WalletAccount
    chartVisible: boolean
    isLoading: boolean
}

export const AccountOverviewHeader = ({
    account,
    chartVisible,
    isLoading,
}: AccountOverviewHeaderProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        portfolioAlgoValue,
        isPending,
        period,
        setPeriod,
        selectedPoint,
        hasBalance,
        canSign,
        togglePrivacyMode,
        handleChartSelectionChange,
    } = useAccountOverviewHeader(account)

    // While loading we always render the primary layout underneath so its mount
    // animations (ExpandablePanel, LineChart) run hidden by the opaque skeleton
    // overlay. By the time the overlay unmounts, everything below is settled.
    const showPrimary = hasBalance || isLoading

    const renderContent = useCallback(() => {
        if (showPrimary) {
            return (
                <>
                    <PWTouchableOpacity
                        onPress={togglePrivacyMode}
                        style={styles.valueBarContainer}
                    >
                        <PWView style={styles.valueBar}>
                            <CurrencyDisplay
                                variant='h1'
                                value={
                                    selectedPoint
                                        ? new Decimal(selectedPoint.algoValue)
                                        : portfolioAlgoValue
                                }
                                currency='ALGO'
                                precision={ALGO_ASSET.decimals}
                                minPrecision={DEFAULT_PRECISION}
                                style={styles.primaryCurrency}
                                isLoading={isPending}
                            />
                        </PWView>
                        <PWView style={styles.secondaryValueBar}>
                            <PreferredCurrencyDisplay
                                variant='h4'
                                style={styles.valueTitle}
                                sourceAmount={
                                    selectedPoint
                                        ? selectedPoint.algoValue
                                        : portfolioAlgoValue
                                }
                                sourceAssetId={ALGO_ASSET.assetId}
                                precision={2}
                                showSymbol
                                prefix='≈ '
                                isLoading={isPending}
                            />

                            {!selectedPoint && (
                                <WealthTrend
                                    account={account}
                                    period={period}
                                />
                            )}
                            {selectedPoint && (
                                <PWText
                                    variant='h4'
                                    style={styles.dateDisplay}
                                >
                                    {formatDatetime(selectedPoint.datetime)}
                                </PWText>
                            )}
                        </PWView>
                    </PWTouchableOpacity>

                    <ExpandablePanel isExpanded={chartVisible}>
                        <PWView style={styles.chartContainer}>
                            <WealthChart
                                account={account}
                                period={period}
                                onSelectionChanged={handleChartSelectionChange}
                            />
                            <ChartPeriodSelection
                                value={period}
                                onChange={setPeriod}
                            />
                        </PWView>
                    </ExpandablePanel>

                    {canSign ? <ButtonPanel /> : <WatchAccountButtonPanel />}
                </>
            )
        }

        if (!canSign) {
            return <WatchAccountButtonPanel />
        }

        return (
            <>
                <PWView style={styles.noBalanceContainer}>
                    <PWText
                        variant='body'
                        style={styles.noBalanceWelcomeText}
                    >
                        {t('account_details.no_balance.welcome')}
                    </PWText>
                    <PWText
                        variant='h1'
                        style={styles.centeredText}
                    >
                        {t('account_details.no_balance.get_started')}
                    </PWText>
                </PWView>
                <NoFundsButtonPanel />
            </>
        )
    }, [
        showPrimary,
        canSign,
        togglePrivacyMode,
        styles,
        selectedPoint,
        portfolioAlgoValue,
        isPending,
        account,
        period,
        chartVisible,
        handleChartSelectionChange,
        setPeriod,
        t,
    ])

    const useLoadingHeight = isLoading && chartVisible

    return (
        <PWView
            style={useLoadingHeight ? styles.headerContainerLoading : undefined}
        >
            {renderContent()}

            {isLoading && (
                <PWView style={styles.skeletonOverlay}>
                    <AccountOverviewHeaderSkeleton
                        chartVisible={chartVisible}
                    />
                </PWView>
            )}
        </PWView>
    )
}
