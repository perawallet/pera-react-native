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

import { AccountOverviewHeader } from './AccountOverviewHeader'
import { SendFundsBottomSheet } from '@modules/transactions/components/SendFunds/PWBottomSheet/SendFundsBottomSheet'
import { ReceiveFundsBottomSheet } from '@modules/transactions/components/ReceiveFunds/PWBottomSheet/ReceiveFundsBottomSheet'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useStyles } from './styles'
import { useAccountOverview } from './useAccountOverview'
import { PWView } from '@components/core'
import { AccountAssetList } from '../AccountAssetList'

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
        hasBalance,
        togglePrivacyMode,
        toggleChartVisible,
        handleChartSelectionChange,
        isSendFundsVisible,
        handleOpenSendFunds,
        handleCloseSendFunds,
        handleSwap,
        handleStake,
        handleMore,
        handleBuyAlgo,
        handleReceive,
        isReceiveFundsVisible,
        handleCloseReceiveFunds,
    } = useAccountOverview(account)

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
                        portfolioFiatValue={portfolioFiatValue}
                        isPending={isPending}
                        period={period}
                        setPeriod={setPeriod}
                        selectedPoint={selectedPoint}
                        chartVisible={chartVisible}
                        preferredCurrency={preferredCurrency}
                        togglePrivacyMode={togglePrivacyMode}
                        toggleChartVisible={toggleChartVisible}
                        handleChartSelectionChange={handleChartSelectionChange}
                        handleSwap={handleSwap}
                        handleStake={handleStake}
                        handleOpenSendFunds={handleOpenSendFunds}
                        handleMore={handleMore}
                        handleBuyAlgo={handleBuyAlgo}
                        handleReceive={handleReceive}
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
        </PWView>
    )
}
