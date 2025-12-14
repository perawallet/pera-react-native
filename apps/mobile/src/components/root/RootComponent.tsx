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
import { useContext, useEffect, useRef } from 'react'
import { AppState, StatusBar } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { MainRoutes } from '../../routes/routes'
import { getNavigationTheme, getTheme } from '../../theme/theme'
import { Text, ThemeProvider, useTheme } from '@rneui/themed'
import { useStyles } from './styles'
import PWView from '../../components/common/view/PWView'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ErrorBoundary from 'react-native-error-boundary'
import useToast from '../../hooks/toast'
import { useIsDarkMode } from '../../hooks/theme'
import { SigningProvider } from '../../providers/SigningProvider'
import {
    useDevice,
    useNetwork,
} from '@perawallet/wallet-core-platform-integration'
import { usePolling } from '@perawallet/wallet-core-polling'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import {
    NetworkStatusContext,
    NetworkStatusProvider,
} from '../../providers/NetworkStatusProvider'
import WebViewProvider from '../../providers/WebViewProvider'
import { useLanguage } from '../../hooks/language'

const RootContentContainer = ({ isDarkMode }: { isDarkMode: boolean }) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { hasInternet } = useContext(NetworkStatusContext)
    const { network } = useNetwork()
    const navTheme = getNavigationTheme(isDarkMode ? 'dark' : 'light')
    const { theme } = useTheme()
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
                <StatusBar
                    barStyle={isDarkMode ? 'light-content' : 'dark-content'}
                    backgroundColor={
                        network === Networks.testnet
                            ? theme.colors.testnetBackground
                            : theme.colors.background
                    }
                />

                {!hasInternet && (
                    <PWView style={styles.offlineTextContainer}>
                        <Text style={styles.offlineText}>
                            {t('common.offline_mode')}
                        </Text>
                    </PWView>
                )}

                <GestureHandlerRootView>
                    <MainRoutes theme={navTheme} />
                </GestureHandlerRootView>
            </PWView>
        </ErrorBoundary>
    )
}

export const RootComponent = () => {
    const isDarkMode = useIsDarkMode()

    const theme = getTheme(isDarkMode ? 'dark' : 'light')
    const { network } = useNetwork()
    const { registerDevice } = useDevice(network)
    const { startPolling, stopPolling } = usePolling()
    const accounts = useAllAccounts()

    const appState = useRef(AppState.currentState)

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
            <NetworkStatusProvider>
                <WebViewProvider>
                    <SigningProvider>
                        <RootContentContainer isDarkMode={isDarkMode} />
                    </SigningProvider>
                </WebViewProvider>
            </NetworkStatusProvider>
        </ThemeProvider>
    )
}
