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
import { LoadingView } from '@components/LoadingView'
import { TransactionErrorBoundary } from '@modules/transactions/components/TransactionErrorBoundary/TransactionErrorBoundary'
import { useLanguage } from '@hooks/useLanguage'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { getNavigationTheme } from '@theme/theme'
import { SendFundsRoutes } from '../../../routes/send-funds'
import { useSendFundsContent } from './useSendFundsContent'

export type SendFundsContentProps = {
    assetId?: string
}

export const SendFundsContent = ({ assetId }: SendFundsContentProps) => {
    const { t } = useLanguage()
    const isDarkMode = useIsDarkMode()
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
                    {/* Theme the independent tree explicitly: without it React
                        Navigation falls back to DefaultTheme, whose grey
                        `background` (rgb(242,242,242)) paints the full-sheet
                        scene container and shows through the transparent
                        header as a grey band. */}
                    <NavigationContainer
                        theme={getNavigationTheme(
                            isDarkMode ? 'dark' : 'light',
                        )}
                    >
                        <SendFundsRoutes />
                    </NavigationContainer>
                </NavigationIndependentTree>
            ) : (
                // Asset-scoped entries hold here until the asset query settles
                // so the initial route is computed from settled data (see
                // useSendFundsContent). A DB read resolves fast; this keeps the
                // sheet from flashing an empty scene while it does.
                <LoadingView variant='circle' />
            )}
        </TransactionErrorBoundary>
    )
}
