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
    initDecimalConfig,
    type Nullable,
} from '@perawallet/wallet-core-shared'
// Initialize Decimal.js configuration before any other imports that may use it
initDecimalConfig()

import React, { useEffect, useState } from 'react'
import './i18n'
import { Platform } from 'react-native'
import { ThemeProvider } from '@rneui/themed'
import { PWText } from '@components/core'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useLanguage } from '@hooks/useLanguage'
import { getTheme } from '@theme/theme'
import { QueryProvider, queryClient } from './providers/QueryProvider'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { Persister } from '@tanstack/react-query-persist-client'
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
import { createCrashReportingErrorReporter } from '@perawallet/wallet-extension-platform'
import {
    getProvider,
    PeraWalletProvider,
    usePeraProvider,
} from '@perawallet/wallet-extension-provider'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { RootComponent } from '@components/RootComponent'
import * as SplashScreen from 'expo-splash-screen'

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync()

import { NotifierWrapper } from 'react-native-notifier'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { logger, updateBackendHeaders } from '@perawallet/wallet-core-shared'

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
            provider.initialize().then(async ({ token }) => {
                setFcmToken(token ?? null)

                // iOS Keychain persists across uninstalls. On first launch after
                // a reinstall, MMKV is empty (wiped by OS) but stale keychain
                // entries from the previous install remain. Clear them.
                const APP_INSTALLED_KEY = 'pera.app_installed'
                if (
                    Platform.OS === 'ios' &&
                    !provider.keyValueStorage.getItem(APP_INSTALLED_KEY)
                ) {
                    await provider.secureStorage.clearAll()
                }
                provider.keyValueStorage.setItem(APP_INSTALLED_KEY, '1')

                await initializeDatabase(provider.database)
                await seedAlgoAsset(getDatabase())

                initializeSyncService({ queryClient })

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
                    SplashScreen.hideAsync()
                }, 200)
            })
        }
    }, [bootstrapped, provider])

    return (
        <ThemeProvider theme={theme}>
            <SafeAreaProvider>
                {!bootstrapped && <PWText>{t('common.loading.label')}</PWText>}
                {bootstrapped && persister && (
                    <GestureHandlerRootView>
                        <NotifierWrapper>
                            <QueryProvider persister={persister}>
                                <RootComponent fcmToken={fcmToken} />
                            </QueryProvider>
                        </NotifierWrapper>
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
