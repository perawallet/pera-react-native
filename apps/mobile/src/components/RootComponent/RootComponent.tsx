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

import { Networks } from '@perawallet/wallet-core-shared'
import { config } from '@perawallet/wallet-core-config'
import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { MainRoutes } from '@routes/index'
import { getTheme } from '@theme/theme'
import { ThemeProvider } from '@rneui/themed'
import { useStyles } from './styles'
import { PWText, PWView } from '@components/core'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ErrorBoundary from 'react-native-error-boundary'
import { useToast } from '@hooks/useToast'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { SigningProvider } from '@modules/transactions/providers/SigningProvider'
import {
    useDevice,
    useNetwork,
} from '@perawallet/wallet-core-platform-integration'
import { usePolling } from '@perawallet/wallet-core-polling'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useNetworkStatus, useNetworkStatusListener } from '@modules/network'
import { WebViewOverlay } from '@modules/webview'
import { useLanguage } from '@hooks/useLanguage'
import { WalletConnectProvider } from '@modules/walletconnect/providers/WalletConnectProvider'
import { useTokenListener } from '@modules/token'

/**
 * Props for the RootComponent.
 */
type RootComponentProps = {
    /** FCM token for push notifications, passed from native side */
    fcmToken: string | null
}

const RootContentContainer = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { hasInternet } = useNetworkStatus()
    const { network } = useNetwork()
    const { showToast } = useToast()
    const { t } = useLanguage()

    const showError = (error: string | Error) => {
        showToast({
            title: 'Error',
            body: config.debugEnabled
                ? `Details: ${error}`
                : 'An error has occured, please try again.',
            type: 'error',
        })
    }

    return (
        <ErrorBoundary onError={showError}>
            <PWView style={styles.container}>
                {network === Networks.testnet && (
                    <PWView style={styles.testnetBar} />
                )}

                {!hasInternet && (
                    <PWView style={styles.offlineTextContainer}>
                        <PWText style={styles.offlineText}>
                            {t('common.offline_mode')}
                        </PWText>
                    </PWView>
                )}

                <GestureHandlerRootView>
                    <MainRoutes />
                </GestureHandlerRootView>
            </PWView>
        </ErrorBoundary>
    )
}

/**
 * The ultimate root component of the application.
 * Responsibility: Setup all global providers (Theme, Signing, WalletConnect) and global listeners.
 *
 * @param props - Component props
 * @example
 * <RootComponent fcmToken="token123" />
 */
export const RootComponent = ({ fcmToken }: RootComponentProps) => {
    const isDarkMode = useIsDarkMode()
    const theme = getTheme(isDarkMode ? 'dark' : 'light')
    const { network } = useNetwork()
    const { registerDevice } = useDevice(network)
    const { startPolling, stopPolling } = usePolling()
    const accounts = useAllAccounts()

    const appState = useRef(AppState.currentState)

    // Initialize network status listener (replaces NetworkStatusProvider)
    useNetworkStatusListener()

    // Initialize FCM token (replaces TokenInitializer)
    useTokenListener(fcmToken)

    useEffect(() => {
        //TODO we should move the registerDevice stuff into the wallet-core somewhere somehow - maybe in setAccounts or something
        registerDevice(accounts?.map(account => account.address) ?? [])

        if (config.pollingEnabled) {
            const subscription = AppState.addEventListener(
                'change',
                nextAppState => {
                    if (
                        appState.current.match(/inactive|background/) &&
                        nextAppState === 'active'
                    ) {
                        startPolling()
                    } else if (
                        appState.current === 'active' &&
                        nextAppState.match(/inactive|background/)
                    ) {
                        stopPolling()
                    }

                    appState.current = nextAppState
                },
            )

            return () => {
                stopPolling()
                subscription.remove()
            }
        }
    }, [accounts])

    return (
        <ThemeProvider theme={theme}>
            <SigningProvider>
                <WalletConnectProvider>
                    <RootContentContainer />
                    <WebViewOverlay />
                </WalletConnectProvider>
            </SigningProvider>
        </ThemeProvider>
    )
}
