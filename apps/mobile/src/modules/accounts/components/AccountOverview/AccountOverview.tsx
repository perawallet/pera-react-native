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

import { useEffect } from 'react'
import { AccountOverviewHeader } from './AccountOverviewHeader'
import { SendFundsBottomSheet } from '@modules/transactions/components/send-funds/SendFundsBottomSheet/SendFundsBottomSheet'
import { ReceiveFundsBottomSheet } from '@modules/transactions/components/receive-funds/ReceiveFundsBottomSheet'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useStyles } from './styles'
import { useAccountOverview } from './useAccountOverview'
import { PWView } from '@components/core'
import { AccountAssetList } from '../AccountAssetList'
import { AccountOptionsBottomSheet } from '../AccountOptionsBottomSheet'

export type AccountOverviewProps = {
    account: WalletAccount
    chartVisible: boolean
    onSwipeEnabledChange?: (enabled: boolean) => void
}

export const AccountOverview = ({
    account,
    chartVisible,
    onSwipeEnabledChange,
}: AccountOverviewProps) => {
    const styles = useStyles()
    const {
        portfolioAlgoValue,
        isPending,
        period,
        setPeriod,
        selectedPoint,
        scrollingEnabled,
        preferredCurrency,
        hasBalance,
        togglePrivacyMode,
        handleChartSelectionChange,
        isSendFundsVisible,
        handleOpenSendFunds,
        handleCloseSendFunds,
        handleSwap,
        handleMore,
        handleBuyAlgo,
        handleReceive,
        handleCopyAddress,
        handleShowQR,
        isReceiveFundsVisible,
        handleCloseReceiveFunds,
        isAccountOptionsVisible,
        handleCloseAccountOptions,
    } = useAccountOverview(account)

    useEffect(() => {
        onSwipeEnabledChange?.(scrollingEnabled)
    }, [scrollingEnabled, onSwipeEnabledChange])

    return (
        <PWView style={styles.container}>
            <AccountAssetList
                account={account}
                scrollEnabled={scrollingEnabled}
                header={
                    <AccountOverviewHeader
                        account={account}
                        hasBalance={hasBalance}
                        portfolioAlgoValue={portfolioAlgoValue}
                        isPending={isPending}
                        period={period}
                        setPeriod={setPeriod}
                        selectedPoint={selectedPoint}
                        preferredCurrency={preferredCurrency}
                        togglePrivacyMode={togglePrivacyMode}
                        handleChartSelectionChange={handleChartSelectionChange}
                        handleSwap={handleSwap}
                        handleOpenSendFunds={handleOpenSendFunds}
                        handleMore={handleMore}
                        handleBuyAlgo={handleBuyAlgo}
                        handleReceive={handleReceive}
                        handleCopyAddress={handleCopyAddress}
                        handleShowQR={handleShowQR}
                        chartVisible={chartVisible}
                    />
                }
            />

            <SendFundsBottomSheet
                isVisible={isSendFundsVisible}
                onClose={handleCloseSendFunds}
            />

            <ReceiveFundsBottomSheet
                isVisible={isReceiveFundsVisible}
                onClose={handleCloseReceiveFunds}
                account={account}
            />

            <AccountOptionsBottomSheet
                isVisible={isAccountOptionsVisible}
                onClose={handleCloseAccountOptions}
                onShowAddress={handleReceive}
                account={account}
            />
        </PWView>
    )
}
