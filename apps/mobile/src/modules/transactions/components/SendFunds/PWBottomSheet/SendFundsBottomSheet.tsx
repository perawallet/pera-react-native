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

import {
    useAccountAssetBalanceQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { PWBottomSheet, PWTabView, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { SendFundsAssetSelectionView } from '../AssetSelection/SendFundsAssetSelectionView'
import { SendFundsInputView } from '../InputView/SendFundsInputView'

import { useLayoutEffect } from 'react'
import { useStyles } from './styles'
import { useWindowDimensions } from 'react-native'
import { SendFundsSelectDestination } from '../SelectDestination/SendFundsSelectDestination'
import { SendFundsTransactionConfirmation } from '../TransactionConfirmation/SendFundsTransactionConfirmation'
import { useSendFunds } from '@modules/transactions/hooks'
import { TransactionErrorBoundary } from '@modules/transactions/components/BaseErrorBoundary/TransactionErrorBoundary'
import { useLanguage } from '@hooks/useLanguage'

export type SendFundsBottomSheetProps = {
    assetId?: string
    isVisible: boolean
    onClose: () => void
}

export type SendFundsTabParamsList = {
    AssetSelection: undefined
    InputAmount: undefined
    SelectDestination: undefined
    ConfirmTransaction: undefined
}

const Tab = PWTabView.createNavigator<SendFundsTabParamsList>()

//TODO: add support for ASA Inbox sends (check whether destination account is opted into asset)
//TODO: something isn't working with canSelectAsset
export const SendFundsBottomSheet = ({
    assetId,
    onClose,
    isVisible,
}: SendFundsBottomSheetProps) => {
    const selectedAccount = useSelectedAccount()
    const dimensions = useWindowDimensions()
    const styles = useStyles(dimensions)
    const { t } = useLanguage()
    const { canSelectAsset, setSelectedAsset, setCanSelectAsset, reset } =
        useSendFunds()
    const { data: assetBalance } = useAccountAssetBalanceQuery(
        selectedAccount ?? undefined,
        assetId,
    )

    useLayoutEffect(() => {
        if (assetId != null) {
            setSelectedAsset(assetBalance ?? undefined)
            setCanSelectAsset(false)
        }
    }, [assetId, assetBalance, setCanSelectAsset, setSelectedAsset])

    const handleFinished = () => {
        reset()
        onClose()
    }

    return (
        <PWBottomSheet
            isVisible={isVisible}
            innerContainerStyle={styles.container}
        >
            <TransactionErrorBoundary t={t}>
                {selectedAccount ? (
                    <Tab.Navigator
                        initialRouteName={
                            canSelectAsset ? 'AssetSelection' : 'InputAmount'
                        }
                        screenOptions={{ swipeEnabled: false }}
                    >
                        <Tab.Screen name='AssetSelection'>
                            {({ navigation }) => (
                                <PWView style={styles.tabItem}>
                                    <SendFundsAssetSelectionView
                                        onSelected={() =>
                                            navigation.navigate('InputAmount')
                                        }
                                        onBack={handleFinished}
                                    />
                                </PWView>
                            )}
                        </Tab.Screen>

                        <Tab.Screen name='InputAmount'>
                            {({ navigation }) => (
                                <PWView style={styles.tabItem}>
                                    <SendFundsInputView
                                        onNext={() =>
                                            navigation.navigate('SelectDestination')
                                        }
                                        onBack={() => {
                                            if (canSelectAsset) {
                                                navigation.navigate('AssetSelection')
                                            } else {
                                                handleFinished()
                                            }
                                        }}
                                    />
                                </PWView>
                            )}
                        </Tab.Screen>

                        <Tab.Screen name='SelectDestination'>
                            {({ navigation }) => (
                                <PWView style={styles.tabItem}>
                                    <SendFundsSelectDestination
                                        onNext={() =>
                                            navigation.navigate('ConfirmTransaction')
                                        }
                                        onBack={() =>
                                            navigation.navigate('InputAmount')
                                        }
                                    />
                                </PWView>
                            )}
                        </Tab.Screen>

                        <Tab.Screen name='ConfirmTransaction'>
                            {({ navigation }) => (
                                <PWView style={styles.tabItem}>
                                    <SendFundsTransactionConfirmation
                                        onNext={handleFinished}
                                        onBack={() =>
                                            navigation.navigate('SelectDestination')
                                        }
                                    />
                                </PWView>
                            )}
                        </Tab.Screen>
                    </Tab.Navigator>
                ) : (
                    <EmptyView
                        title={t('send_funds.bottom_sheet.no_account_title')}
                        body={t('send_funds.bottom_sheet.no_account_body')}
                    />
                )}
            </TransactionErrorBoundary>
        </PWBottomSheet>
    )
}
