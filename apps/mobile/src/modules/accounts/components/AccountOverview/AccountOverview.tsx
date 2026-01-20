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

import { PWButton, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import Decimal from 'decimal.js'
import { WealthChart } from '@components/WealthChart'
import { ButtonPanel } from '../ButtonPanel'
import { AccountAssetList } from '../AccountAssetList'
import { useStyles } from './styles'
import { WealthTrend } from '@components/WealthTrend'
import { ChartPeriodSelection } from '@components/ChartPeriodSelection'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { ExpandablePanel } from '@components/ExpandablePanel'
import { useAccountOverview } from './useAccountOverview'

type AccountOverviewProps = {
    account: WalletAccount
}

//TODO implement min balance display and info icon
//TODO layout and spacing needs a bit of clean up
export const AccountOverview = ({ account }: AccountOverviewProps) => {
    const styles = useStyles()
    const {
        portfolioAlgoValue,
        portfolioFiatValue,
        isPending,
        period,
        setPeriod,
        selectedPoint,
        chartVisible,
        scrollingEnabled,
        preferredCurrency,
        togglePrivacyMode,
        toggleChartVisible,
        handleChartSelectionChange,
    } = useAccountOverview(account)

    return (
        <PWView style={styles.container}>
            <PWTouchableOpacity
                onPress={togglePrivacyMode}
                style={styles.valueBarContainer}
            >
                <PWView style={styles.valueBar}>
                    <CurrencyDisplay
                        h1
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
                        style={styles.valueTitle}
                        value={
                            selectedPoint
                                ? Decimal(selectedPoint.fiatValue)
                                : portfolioFiatValue
                        }
                        currency={preferredCurrency}
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

            <ExpandablePanel
                isExpanded={chartVisible}
                containerStyle={styles.chartContainer}
            >
                <WealthChart
                    account={account}
                    period={period}
                    onSelectionChanged={handleChartSelectionChange}
                />
                <ChartPeriodSelection
                    value={period}
                    onChange={setPeriod}
                />
            </ExpandablePanel>

            <ButtonPanel />

            <AccountAssetList
                account={account}
                scrollEnabled={scrollingEnabled}
            />
        </PWView>
    )
}
