/*
 Copyright 2022-2026 Pera Wallet, LDA
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

import { EmptyView } from '@components/EmptyView'
import { TransactionErrorBoundary } from '@modules/transactions/components/TransactionErrorBoundary/TransactionErrorBoundary'
import { useLanguage } from '@hooks/useLanguage'
import { SendFundsRoutes } from '../../../routes/send-funds'
import { useSendFundsContent } from './useSendFundsContent'

export type SendFundsContentProps = {
    assetId?: string
}

export const SendFundsContent = ({ assetId }: SendFundsContentProps) => {
    const { t } = useLanguage()
    const { selectedAccount, isReady } = useSendFundsContent(assetId)

    return (
        <TransactionErrorBoundary t={t}>
            {!selectedAccount ? (
                <EmptyView
                    title={t('send_funds.bottom_sheet.no_account_title')}
                    body={t('send_funds.bottom_sheet.no_account_body')}
                />
            ) : isReady ? (
                <NavigationIndependentTree>
                    <NavigationContainer>
                        <SendFundsRoutes />
                    </NavigationContainer>
                </NavigationIndependentTree>
            ) : null}
        </TransactionErrorBoundary>
    )
}
