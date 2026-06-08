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

import { useEffect } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { trackScreen, AnalyticsScreenName } from '@analytics'
import { TransactionErrorBoundary } from '@modules/transactions/components/TransactionErrorBoundary/TransactionErrorBoundary'
import { ReceiveFundsRoutes } from '../../../routes/receive-funds'
import { useReceiveFundsContent } from './useReceiveFundsContent'

export type ReceiveFundsContentProps = {
    account?: WalletAccount
}

export const ReceiveFundsContent = ({ account }: ReceiveFundsContentProps) => {
    const { t } = useLanguage()
    useReceiveFundsContent(account)

    useEffect(() => {
        trackScreen(AnalyticsScreenName.ShowQr)
    }, [])

    return (
        <TransactionErrorBoundary t={t}>
            <NavigationIndependentTree>
                <NavigationContainer>
                    <ReceiveFundsRoutes />
                </NavigationContainer>
            </NavigationIndependentTree>
        </TransactionErrorBoundary>
    )
}
