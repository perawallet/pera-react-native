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
    NavigationContainer,
    NavigationIndependentTree,
} from '@react-navigation/native'

import { PWBottomSheet } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionErrorBoundary } from '@modules/transactions/components/TransactionErrorBoundary/TransactionErrorBoundary'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { ReceiveFundsRoutes } from '../../../routes/receive-funds'
import { useReceiveFundsBottomSheet } from './useReceiveFundsBottomSheet'
import { useStyles } from './styles'

export type ReceiveFundsBottomSheetProps = {
    account?: WalletAccount
    isVisible: boolean
    onClose: () => void
}

export const ReceiveFundsBottomSheet = ({
    account,
    onClose,
    isVisible,
}: ReceiveFundsBottomSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    useReceiveFundsBottomSheet(isVisible, account, onClose)

    return (
        <PWBottomSheet
            isVisible={isVisible}
            innerContainerStyle={styles.container}
            size='lg'
            onBackdropPress={onClose}
            enablePanDownToClose
            autoCreateContainer={false}
        >
            <TransactionErrorBoundary t={t}>
                <NavigationIndependentTree>
                    <NavigationContainer>
                        <ReceiveFundsRoutes />
                    </NavigationContainer>
                </NavigationIndependentTree>
            </TransactionErrorBoundary>
        </PWBottomSheet>
    )
}
