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

import { WalletAccount } from '@perawallet/wallet-core-accounts'
import { PWBottomSheet } from '@components/core/PWBottomSheet'

import { useState } from 'react'
import { useStyles } from './styles'
import { useWindowDimensions } from 'react-native'
import { TabView } from '@rneui/themed'
import { TransactionErrorBoundary } from '@modules/transactions/components/BaseErrorBoundary/TransactionErrorBoundary'
import { TAB_ANIMATION_CONFIG } from '@constants/ui'
import { useLanguage } from '@hooks/language'
import { ReceiveFundsAccountSelectionView } from '../AccountSelection/ReceiveFundsAccountSelectionView'
import { ReceiveFundsQRView } from '../QrView/ReceiveFundsQRView'
import { PWView } from '@components/core/PWView'

type ReceiveFundsBottomSheetProps = {
    account?: WalletAccount
    isVisible: boolean
    onClose: () => void
}

export const ReceiveFundsBottomSheet = ({
    account,
    onClose,
    isVisible,
}: ReceiveFundsBottomSheetProps) => {
    const [screenIndex, setScreenIndex] = useState(0)
    const dimensions = useWindowDimensions()
    const styles = useStyles(dimensions)
    const { t } = useLanguage()
    const [selectedAccount, setSelectedAccount] = useState(account)

    const handleClose = () => {
        setSelectedAccount(account)
        setScreenIndex(0)
        onClose()
    }

    const handleSelected = (account?: WalletAccount) => {
        setSelectedAccount(account)
        setScreenIndex(screenIndex + 1)
    }

    const handleBack = () => {
        setScreenIndex(screenIndex - 1)
    }

    return (
        <PWBottomSheet
            isVisible={isVisible}
            innerContainerStyle={styles.container}
        >
            <PWView style={styles.innerContainer}>
                <TransactionErrorBoundary t={t}>
                    <TabView
                        value={screenIndex}
                        animationType='timing'
                        animationConfig={TAB_ANIMATION_CONFIG}
                        disableSwipe
                    >
                        {!account && (
                            <TabView.Item style={styles.tabItem}>
                                <ReceiveFundsAccountSelectionView
                                    onSelected={handleSelected}
                                    onClose={handleClose}
                                />
                            </TabView.Item>
                        )}
                        <TabView.Item style={styles.tabItem}>
                            <ReceiveFundsQRView
                                account={selectedAccount}
                                onClose={handleClose}
                                onBack={account ? undefined : handleBack}
                            />
                        </TabView.Item>
                    </TabView>
                </TransactionErrorBoundary>
            </PWView>
        </PWBottomSheet>
    )
}
