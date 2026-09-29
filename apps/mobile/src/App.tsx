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

import React from 'react'
import './i18n'
import { ThemeProvider } from '@rneui/themed'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { PeraWalletProvider } from '@perawallet/wallet-extension-provider'
import { useAppIntegrityBootstrap } from '@perawallet/wallet-core-app-integrity'
import { FullScreenLoadingView } from '@components/FullScreenLoadingView'
import { EmptyView } from '@components/EmptyView/EmptyView'
import { PWButton } from '@components/core'
import { RootComponent } from '@components/RootComponent'
import { useAppTheme } from '@hooks/useAppTheme'
import { useCrashReporterBinding } from '@hooks/useCrashReporterBinding'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useOrientationPolicy } from '@hooks/useOrientationPolicy'
import { useSystemBarsAppearance } from '@hooks/useSystemBarsAppearance'
import { useLanguage } from '@hooks/useLanguage'
import { AppProviders } from './providers/AppProviders'
import { usePasskeyAutofillLifecycle } from './bootstrap/passkey-autofill'
import { useAppBootstrap } from './useAppBootstrap'

// Process-wide setup (Decimal config, network status, splash hold, sheet
// registry) runs before this tree mounts: see bootstrap/preReact.ts.
const AppContent = () => {
    const { t } = useLanguage()
    const isDarkMode = useIsDarkMode()
    const theme = useAppTheme()

    const { bootstrapped, persister, fcmToken, initError, retryBootstrap } =
        useAppBootstrap()

    useSystemBarsAppearance(isDarkMode)
    useOrientationPolicy()
    usePasskeyAutofillLifecycle()
    useAppIntegrityBootstrap()
    useCrashReporterBinding()

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
                    // The app's only GestureHandlerRootView: gesture handlers
                    // and bottom-sheet portals must all render beneath it.
                    <GestureHandlerRootView>
                        <AppProviders persister={persister}>
                            <RootComponent fcmToken={fcmToken} />
                        </AppProviders>
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
