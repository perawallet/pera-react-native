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

import NetInfo from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'

NetInfo.fetch()
    .then(state => onlineManager.setOnline(state.isConnected === true))
    .catch(() => onlineManager.setOnline(false))

import {
    initDecimalConfig,
    logger,
    updateBackendHeaders,
    type Nullable,
} from '@perawallet/wallet-core-shared'
// Initialize Decimal.js configuration before any other imports that may use it
initDecimalConfig()

import React, { useEffect, useState } from 'react'
import './i18n'
import { ThemeProvider } from '@rneui/themed'
import { FullScreenLoadingView } from '@components/FullScreenLoadingView'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useLanguage } from '@hooks/useLanguage'
import { getTheme } from '@theme/theme'
import { QueryProvider, queryClient } from './providers/QueryProvider'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { type Persister } from '@tanstack/react-query-persist-client'
import {
    algorandSafeQuerySerialize,
    algorandSafeQueryParse,
} from '@perawallet/wallet-core-blockchain'
import {
    initializeDatabase,
    getDatabase,
} from '@perawallet/wallet-core-database'
import { seedAlgoAsset } from '@perawallet/wallet-core-assets'
import { initializeSyncService } from '@perawallet/wallet-core-background'
import { setOnConfirmedHandler } from '@perawallet/wallet-core-signing'
import { createCrashReportingErrorReporter } from '@perawallet/wallet-extension-platform'
import {
    getProvider,
    hydrateKeystore,
    PeraWalletProvider,
    usePeraProvider,
} from '@perawallet/wallet-extension-provider'
import { useAppIntegrityBootstrap } from '@perawallet/wallet-core-app-integrity'
import {
    runPasskeyAutofillBootstrap,
    usePasskeyAutofillLifecycle,
} from './bootstrap/passkey-autofill'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { RootComponent } from '@components/RootComponent'
// Side-effect: binds every entry in the bottom-sheet manager's typed
// registry (see modules/bottom-sheet/registrations.ts) before anything in
// the React tree mounts, so deep links and other non-React callers can
// safely call useBottomSheetStore.getState().requestByType(...) from the
// moment the app boots.
import '@modules/bottom-sheet/registrations'
import * as SplashScreen from 'expo-splash-screen'

// Keep the splash screen visible while we fetch resources
void SplashScreen.preventAutoHideAsync()

import { NotifierWrapper } from 'react-native-notifier'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { EmptyView } from '@components/EmptyView/EmptyView'

const updateQueryHeaders = () => {
    const deviceInfo = getProvider().deviceInfo
    const headers = new Map<string, string>()
    headers.set('App-Name', deviceInfo.getAppName())
    headers.set('App-Package-Name', deviceInfo.getAppPackage())
    headers.set('App-Version', deviceInfo.getAppVersion())
    headers.set('Client-Type', deviceInfo.getDevicePlatform())
    headers.set('Device-Version', deviceInfo.getDeviceLocale())
    headers.set('Device-OS-Version', deviceInfo.getDeviceOSVersion())
    headers.set('Device-Model', deviceInfo.getDeviceModelId())
    headers.set('User-Agent', deviceInfo.getUserAgent())
    updateBackendHeaders(headers)
}

const AppContent = () => {
    const [persister, setPersister] = useState<Persister>()
    const [bootstrapped, setBootstrapped] = useState(false)
    const [fcmToken, setFcmToken] = useState<Nullable<string>>(null)
    const { t } = useLanguage()
    const provider = usePeraProvider()
    const isDarkMode = useIsDarkMode()
    const theme = getTheme(isDarkMode ? 'dark' : 'light')
    const [initError, setInitError] = useState<boolean>(false)

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

    useEffect(() => {
        if (!bootstrapped) {
            void provider.initialize().then(async ({ token }) => {
                setFcmToken(token ?? null)

                // do startup hydration and setup in parallel to speed up time to interactive
                const keystoreBranch = hydrateKeystore().catch(err => {
                    setInitError(true)
                    logger.error('Keystore hydration failed', { error: err })
                })

                const passkeyBranch = runPasskeyAutofillBootstrap().catch(err =>
                    logger.error('Passkey autofill bootstrap failed', {
                        error: err,
                    }),
                )

                const databaseBranch = initializeDatabase(
                    provider.database,
                ).then(() => seedAlgoAsset(getDatabase()))

                await Promise.all([
                    keystoreBranch,
                    passkeyBranch,
                    databaseBranch,
                ])

                initializeSyncService({
                    queryClient,
                    registerCompletionHandler: setOnConfirmedHandler,
                })

                updateQueryHeaders()

                const reactQueryPersistor = createAsyncStoragePersister({
                    storage: provider.keyValueStorage,
                    serialize: algorandSafeQuerySerialize,
                    deserialize: algorandSafeQueryParse,
                })

                setPersister(reactQueryPersistor)

                setBootstrapped(true)

                //we defer the hiding so the initial layout can happen
                setTimeout(() => {
                    void SplashScreen.hideAsync()
                }, 200)
            })
        }
    }, [bootstrapped, provider])

    if (initError) {
        return (
            <ThemeProvider theme={theme}>
                <SafeAreaProvider>
                    <EmptyView
                        title={t('app.initialization_failed.title')}
                        body={t('app.initialization_failed.body')}
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
