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

import { useEffect } from 'react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { getNavigationTheme } from '@theme/theme'
import { trackScreen, AnalyticsScreenName } from '@analytics'
import { TransactionErrorBoundary } from '@modules/transactions/components/TransactionErrorBoundary/TransactionErrorBoundary'
import { ReceiveFundsRoutes } from '../../../routes/receive-funds'
import { useReceiveFundsContent } from './useReceiveFundsContent'

export type ReceiveFundsContentProps = {
    account?: WalletAccount
}

export const ReceiveFundsContent = ({ account }: ReceiveFundsContentProps) => {
    const { t } = useLanguage()
    const isDarkMode = useIsDarkMode()
    useReceiveFundsContent(account)

    // Tracked in-screen rather than via the navigator's screenListeners: this
    // is rendered as a bottom sheet (its own NavigationContainer below), not a
    // route in the app's main navigator.
    useEffect(() => {
        trackScreen(AnalyticsScreenName.ShowQr)
    }, [])

    return (
        <TransactionErrorBoundary t={t}>
            <NavigationIndependentTree>
                {/* Theme the independent tree explicitly: without it React
                    Navigation falls back to DefaultTheme, whose grey
                    `background` (rgb(242,242,242)) paints the full-sheet scene
                    container and shows through the transparent header as a
                    grey band. */}
                <NavigationContainer
                    theme={getNavigationTheme(isDarkMode ? 'dark' : 'light')}
                >
                    <ReceiveFundsRoutes />
                </NavigationContainer>
            </NavigationIndependentTree>
        </TransactionErrorBoundary>
    )
}
