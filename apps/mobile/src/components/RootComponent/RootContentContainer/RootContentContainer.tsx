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
    useSelectedScope,
    useWalletDeployment,
} from '@perawallet/wallet-core-chain-shared'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { MainRoutes } from '@routes/index'
import { useStyles } from './styles'
import type { RootComponentProps } from '../RootComponent'
import { PWText, PWView } from '@components/core'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ErrorBoundary from 'react-native-error-boundary'
import { useErrorToast } from '@hooks/useErrorToast'
import { logger } from '@perawallet/wallet-core-shared'
import { useNetworkStatusListener } from '@modules/network'
import { WebViewOverlay } from '@modules/webview/shell'
import { PromptContainer } from '@modules/prompts'
import { useLanguage } from '@hooks/useLanguage'
import { useNetworkLabel } from '@hooks/useNetworkLabel'
import {
    useAppQuickActions,
    useNotificationDeeplinkListener,
    usePendingScanRequest,
} from '@modules/deeplink/shell'
import { useNotificationReceivedListener } from '@hooks/useNotificationReceivedListener'
import { PairingProgressOverlay } from '@modules/walletconnect/shell'
import { useTokenListener } from '@modules/token'
import { usePhishingListRefresh } from '@modules/site-safety/shell'

export type RootContentContainerProps = RootComponentProps

export const RootContentContainer = ({
    fcmToken,
}: RootContentContainerProps) => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const isLive = useWalletDeployment() === 'live'
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { showError } = useErrorToast()
    const { t } = useLanguage()
    const networkLabel = useNetworkLabel()

    useNetworkStatusListener()
    useTokenListener(fcmToken)
    useNotificationDeeplinkListener()
    useAppQuickActions()
    usePendingScanRequest()
    // Refresh the notification badge/inbox as soon as a foreground push lands.
    useNotificationReceivedListener()
    usePhishingListRefresh()

    const handleBoundaryError = (error: string | Error) => {
        logger.critical(error, {
            source: 'RootComponentErrorBoundary',
        })

        showError(error, t('errors.general.title'))
    }

    return (
        <ErrorBoundary onError={handleBoundaryError}>
            <PWView style={styles.container}>
                {!isLive && (
                    <PWView style={styles.testnetBar}>
                        <PWText style={styles.testnetText}>
                            {networkLabel(scope.networkId)}
                        </PWText>
                    </PWView>
                )}

                {/* AppContent mounts the single GestureHandlerRootView above this tree. */}
                <PWView style={styles.content}>
                    <MainRoutes />
                    <WebViewOverlay />
                    {/* After WebViewOverlay so a deep-link pairing scrim
                        paints above the in-app browser too. */}
                    <PairingProgressOverlay />
                    {/* Blocking prompts paint above the navigator and tab bar, but
                        inside AutoLockGuard's children so the lock still hides them. */}
                    <PromptContainer />
                </PWView>
            </PWView>
        </ErrorBoundary>
    )
}
