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

import { config } from '@perawallet/wallet-core-config'
import { useEffect, useRef } from 'react'
import { AppState, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { MainRoutes } from '@routes/index'
import { getTheme } from '@theme/theme'
import { ThemeProvider } from '@rneui/themed'
import { useStyles } from './styles'
import { PWText, PWView } from '@components/core'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ErrorBoundary from 'react-native-error-boundary'
import { useToast } from '@hooks/useToast'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useDevice } from '@perawallet/wallet-core-device'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { usePolling } from '@perawallet/wallet-core-polling'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useNetworkStatus, useNetworkStatusListener } from '@modules/network'
import { WebViewOverlay } from '@modules/webview'
import { useLanguage } from '@hooks/useLanguage'
import { WalletConnectProvider } from '@modules/walletconnect/providers/WalletConnectProvider'
import { useTokenListener } from '@modules/token'
import { AutoLockGuard } from '@modules/security/components/AutoLockGuard/AutoLockGuard'
import { SigningOverlays } from '@modules/signing/components/SigningOverlays'
import {
    getAppStatePlatform,
    getAppStateTransition,
} from '@utils/app-state'

export type RootComponentProps = {
    fcmToken: string | null
}

const RootContentContainer = ({ fcmToken }: RootComponentProps) => {
    const { isTestnet } = useNetwork()
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { hasInternet } = useNetworkStatus()
    const { showToast } = useToast()
    const { t } = useLanguage()

    // Initialize network status listener (replaces NetworkStatusProvider)
    useNetworkStatusListener()

    // Initialize FCM token (replaces TokenInitializer)
    useTokenListener(fcmToken)

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
                {isTestnet && (
                    <View style={styles.testnetBar}>
                        <PWText style={styles.testnetText}>Testnet</PWText>
                    </View>
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
                    <WebViewOverlay />
                </GestureHandlerRootView>
            </PWView>
        </ErrorBoundary>
    )
}

export const RootComponent = ({ fcmToken }: RootComponentProps) => {
    const isDarkMode = useIsDarkMode()
    const theme = getTheme(isDarkMode ? 'dark' : 'light')
    const { network } = useNetwork()
    const { registerDevice } = useDevice()
    const { startPolling, stopPolling } = usePolling()
    const accounts = useAllAccounts()

    const appState = useRef(AppState.currentState)
    const appStatePlatform = useRef(getAppStatePlatform()).current

    useEffect(() => {
        //TODO we should move the registerDevice stuff into the wallet-core somewhere somehow - maybe in setAccounts or something
        const addresses = accounts?.map(account => account.address) ?? []
        registerDevice(addresses)

        if (!addresses.length) {
            stopPolling()
        } else if (config.pollingEnabled) {
            const subscription = AppState.addEventListener(
                'change',
                nextAppState => {
                    const { didLeaveForeground, didEnterForeground } =
                        getAppStateTransition(
                            appState.current,
                            nextAppState,
                            appStatePlatform,
                        )

                    if (didEnterForeground) {
                        startPolling()
                    } else if (didLeaveForeground) {
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
    }, [appStatePlatform, network, accounts, registerDevice, startPolling, stopPolling])

    return (
        <ThemeProvider theme={theme}>
            <BottomSheetModalProvider>
                <AutoLockGuard>
                    <WalletConnectProvider>
                        <RootContentContainer fcmToken={fcmToken} />
                    </WalletConnectProvider>
                    <SigningOverlays />
                </AutoLockGuard>
            </BottomSheetModalProvider>
        </ThemeProvider>
    )
}
