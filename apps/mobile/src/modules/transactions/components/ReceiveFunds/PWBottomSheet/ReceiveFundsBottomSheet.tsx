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
import { PWBottomSheet, PWTabView, PWView } from '@components/core'

import { useState } from 'react'
import { useStyles } from './styles'
import { useWindowDimensions } from 'react-native'
import { TransactionErrorBoundary } from '@modules/transactions/components/BaseErrorBoundary/TransactionErrorBoundary'
import { useLanguage } from '@hooks/useLanguage'
import { ReceiveFundsAccountSelectionView } from '../AccountSelection/ReceiveFundsAccountSelectionView'
import { ReceiveFundsQRView } from '../QrView/ReceiveFundsQRView'

export type ReceiveFundsBottomSheetProps = {
    account?: WalletAccount
    isVisible: boolean
    onClose: () => void
}

export type ReceiveFundsTabParamsList = {
    AccountSelection: undefined
    QRView: undefined
}

const Tab = PWTabView.createNavigator<ReceiveFundsTabParamsList>()

export const ReceiveFundsBottomSheet = ({
    account,
    onClose,
    isVisible,
}: ReceiveFundsBottomSheetProps) => {
    const dimensions = useWindowDimensions()
    const styles = useStyles(dimensions)
    const { t } = useLanguage()
    const [selectedAccount, setSelectedAccount] = useState(account)

    const handleClose = () => {
        setSelectedAccount(account)
        onClose()
    }

    return (
        <PWBottomSheet
            isVisible={isVisible}
            innerContainerStyle={styles.container}
        >
            <TransactionErrorBoundary t={t}>
                {account ? (
                    <PWView style={styles.tabItem}>
                        <ReceiveFundsQRView
                            account={selectedAccount}
                            onClose={handleClose}
                        />
                    </PWView>
                ) : (
                    <Tab.Navigator
                        screenOptions={{
                            swipeEnabled: false,
                        }}
                    >
                        <Tab.Screen name='AccountSelection'>
                            {({ navigation }) => (
                                <PWView style={styles.tabItem}>
                                    <ReceiveFundsAccountSelectionView
                                        onSelected={acc => {
                                            setSelectedAccount(acc)
                                            navigation.navigate('QRView')
                                        }}
                                        onClose={handleClose}
                                    />
                                </PWView>
                            )}
                        </Tab.Screen>
                        <Tab.Screen name='QRView'>
                            {({ navigation }) => (
                                <PWView style={styles.tabItem}>
                                    <ReceiveFundsQRView
                                        account={selectedAccount}
                                        onClose={handleClose}
                                        onBack={() => navigation.goBack()}
                                    />
                                </PWView>
                            )}
                        </Tab.Screen>
                    </Tab.Navigator>
                )}
            </TransactionErrorBoundary>
        </PWBottomSheet>
    )
}
