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

import { useEffect, useMemo } from 'react'
import { AccountOverviewHeader } from './AccountOverviewHeader'
import { SendFundsBottomSheet } from '@modules/transactions/components/send-funds/SendFundsBottomSheet/SendFundsBottomSheet'
import { ReceiveFundsBottomSheet } from '@modules/transactions/components/receive-funds/ReceiveFundsBottomSheet'
import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useStyles } from './styles'
import { useAccountOverview } from './useAccountOverview'
import { PWView } from '@components/core'
import { AccountAssetList } from '../AccountAssetList'
import { AccountOptionsBottomSheet } from '../AccountOptionsBottomSheet'
import {
    AccountOverviewModalContext,
    UseAccountOverviewModalResult,
} from './AccountOverviewModalContext'

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
        isSendFundsVisible,
        openSendFunds,
        handleCloseSendFunds,
        isReceiveFundsVisible,
        openReceiveFunds,
        handleCloseReceiveFunds,
        isAccountOptionsVisible,
        openAccountOptions,
        handleCloseAccountOptions,
        scrollingEnabled,
        onScrollEnabledChange,
    } = useAccountOverview(account)

    useEffect(() => {
        onSwipeEnabledChange?.(scrollingEnabled)
    }, [scrollingEnabled, onSwipeEnabledChange])

    const contextValue = useMemo<UseAccountOverviewModalResult>(
        () => ({
            account,
            openSendFunds,
            openReceiveFunds,
            openAccountOptions,
            onScrollEnabledChange,
        }),
        [
            account,
            openSendFunds,
            openReceiveFunds,
            openAccountOptions,
            onScrollEnabledChange,
        ],
    )

    return (
        <AccountOverviewModalContext.Provider value={contextValue}>
            <PWView style={styles.container}>
                <AccountAssetList
                    account={account}
                    scrollEnabled={scrollingEnabled}
                    header={
                        <AccountOverviewHeader
                            account={account}
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
                    onShowAddress={openReceiveFunds}
                    account={account}
                />
            </PWView>
        </AccountOverviewModalContext.Provider>
    )
}
