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

import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import { formatDatetime, HistoryPeriod } from '@perawallet/wallet-core-shared'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import Decimal from 'decimal.js'
import { WealthChart } from '@components/WealthChart'
import { ButtonPanel } from '../ButtonPanel'
import { useStyles } from './styles'
import { WealthTrend } from '@components/WealthTrend'
import { ChartPeriodSelection } from '@components/ChartPeriodSelection'
import {
    AccountBalanceHistoryItem,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'

import { useLanguage } from '@hooks/useLanguage'
import { NoFundsButtonPanel } from '../NoFundsButtonPanel'

export type AccountOverviewHeaderProps = {
    account: WalletAccount
    hasBalance: boolean
    portfolioAlgoValue: Decimal
    portfolioFiatValue: Decimal
    isPending: boolean
    period: HistoryPeriod
    setPeriod: (period: HistoryPeriod) => void
    selectedPoint: AccountBalanceHistoryItem | null
    preferredFiatCurrency: string
    togglePrivacyMode: () => void
    handleChartSelectionChange: (
        selected: AccountBalanceHistoryItem | null,
    ) => void
    handleSwap: () => void
    handleOpenSendFunds: () => void
    handleMore: () => void
    handleBuyAlgo: () => void
    handleReceive: () => void
}

export const AccountOverviewHeader = ({
    account,
    hasBalance,
    portfolioAlgoValue,
    portfolioFiatValue,
    isPending,
    period,
    setPeriod,
    selectedPoint,
    preferredFiatCurrency,
    togglePrivacyMode,
    handleChartSelectionChange,
    handleSwap,
    handleOpenSendFunds,
    handleMore,
    handleBuyAlgo,
    handleReceive,
}: AccountOverviewHeaderProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return hasBalance ? (
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
                                ? Decimal(selectedPoint.algoValue)
                                : portfolioAlgoValue
                        }
                        currency='ALGO'
                        precision={2}
                        style={styles.primaryCurrency}
                        isLoading={isPending}
                    />
                </PWView>
                <PWView style={styles.secondaryValueBar}>
                    <CurrencyDisplay
                        variant='h4'
                        style={styles.valueTitle}
                        value={
                            selectedPoint
                                ? Decimal(selectedPoint.fiatValue)
                                : portfolioFiatValue
                        }
                        currency={preferredFiatCurrency}
                        prefix='≈ '
                        precision={2}
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

            <ButtonPanel
                onSwap={handleSwap}
                onSend={handleOpenSendFunds}
                onReceive={handleReceive}
                onMore={handleMore}
            />
        </>
    ) : (
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
            <NoFundsButtonPanel
                onBuyAlgo={handleBuyAlgo}
                onReceive={handleReceive}
                onMore={handleMore}
            />
        </>
    )
}
