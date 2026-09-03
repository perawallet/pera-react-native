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

import { initNetworkStatus } from '@modules/network'

// Seed reachability-aware connectivity and wire onlineManager before the query
// layer mounts, so early queries never fire-and-fail against a dead link.
void initNetworkStatus()

import { initDecimalConfig, logger } from '@perawallet/wallet-core-shared'
// Initialize Decimal.js configuration before any other imports that may use it
initDecimalConfig()

import React, { useEffect } from 'react'
import './i18n'
import { ThemeProvider } from '@rneui/themed'
import { FullScreenLoadingView } from '@components/FullScreenLoadingView'
import { PWButton } from '@components/core'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useSystemBarsAppearance } from '@hooks/useSystemBarsAppearance'
import { useLanguage } from '@hooks/useLanguage'
import { getTheme } from '@theme/theme'
import { QueryProvider } from './providers/QueryProvider'
import { createCrashReportingErrorReporter } from '@perawallet/wallet-extension-platform'
import {
    PeraWalletProvider,
    usePeraProvider,
} from '@perawallet/wallet-extension-provider'
import { useAppIntegrityBootstrap } from '@perawallet/wallet-core-app-integrity'
import { usePasskeyAutofillLifecycle } from './bootstrap/passkey-autofill'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { RootComponent } from '@components/RootComponent'
import { useAppBootstrap } from './useAppBootstrap'
// Side-effect: binds every entry in the bottom-sheet manager's typed
// registry (see modules/bottom-sheet/registrations.ts) before anything in
// the React tree mounts, so deep links and other non-React callers can
// safely call useBottomSheetStore.getState().requestByType(...) from the
// moment the app boots.
import '@modules/bottom-sheet/registrations'
// Side-effect: hands the locale-tour driver to its registry so the deeplink
// handler can reach it without importing it (modules/locale-tour/registry.ts
// explains why that indirection exists). Resolves to a no-op stub in every
// non-dev bundle, which is what keeps the driver out of release builds.
import '@modules/locale-tour/register'
import * as SplashScreen from 'expo-splash-screen'

// TODO(card): remove once the Baanx transactions sandbox returns data. Dev-only
// transport mock so the card transaction list shows data; the dynamic import is
// dead code in release builds (`__DEV__` is statically false), so it never ships.
if (__DEV__) {
    void import('@modules/card/devMocks').then(({ installCardDevMocks }) => {
        installCardDevMocks()
    })
}

// Keep the splash screen visible while we fetch resources
void SplashScreen.preventAutoHideAsync()

import { NotifierWrapper } from 'react-native-notifier'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { EmptyView } from '@components/EmptyView/EmptyView'

const AppContent = () => {
    const { t } = useLanguage()
    const provider = usePeraProvider()
    const isDarkMode = useIsDarkMode()
    const theme = getTheme(isDarkMode ? 'dark' : 'light')

    const { bootstrapped, persister, fcmToken, initError, retryBootstrap } =
        useAppBootstrap()

    useSystemBarsAppearance(isDarkMode)
    usePasskeyAutofillLifecycle()
    useAppIntegrityBootstrap()

    useEffect(() => {
        logger.setErrorReporter(
            createCrashReportingErrorReporter(provider.crashReporting),
        )

        return () => {
            logger.setErrorReporter(undefined)
        }
    }, [provider])

    if (initError) {
        // A keystore-integrity failure recurs on every launch, so the generic
        // "try restarting" copy would send users toward a destructive
        // reinstall; it gets its own message instead.
        const errorKey =
            initError === 'keystore'
                ? 'app.initialization_failed.keystore'
                : 'app.initialization_failed'
        return (
            <ThemeProvider theme={theme}>
                <SafeAreaProvider>
                    <EmptyView
                        title={t(`${errorKey}.title`)}
                        body={t(`${errorKey}.body`)}
                        button={
                            <PWButton
                                variant='primary'
                                title={t('app.initialization_failed.retry')}
                                onPress={retryBootstrap}
                            />
                        }
                    />
                </SafeAreaProvider>
            </ThemeProvider>
        )
    }

    return (
        <ThemeProvider theme={theme}>
            <SafeAreaProvider>
                {!bootstrapped && <FullScreenLoadingView />}
                {bootstrapped && persister && (
                    <GestureHandlerRootView>
                        <KeyboardProvider>
                            <NotifierWrapper
                                componentProps={{
                                    ContainerComponent: SafeAreaView,
                                }}
                            >
                                <QueryProvider persister={persister}>
                                    <RootComponent fcmToken={fcmToken} />
                                </QueryProvider>
                            </NotifierWrapper>
                        </KeyboardProvider>
                    </GestureHandlerRootView>
                )}
            </SafeAreaProvider>
        </ThemeProvider>
    )
}

export const App = () => {
    return (
        <PeraWalletProvider>
            <AppContent />
        </PeraWalletProvider>
    )
}
