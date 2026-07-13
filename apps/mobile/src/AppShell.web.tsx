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
    logger,
    updateBackendHeaders,
} from '@perawallet/wallet-core-shared'
// Initialize Decimal.js configuration before any other imports that may use it
initDecimalConfig()

import React from 'react'
import './i18n'
import { ThemeProvider, makeStyles } from '@rneui/themed'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { NavigationContainer } from '@react-navigation/native'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import {
    algorandSafeQuerySerialize,
    algorandSafeQueryParse,
} from '@perawallet/wallet-core-blockchain'
import {
    getProvider,
    PeraWalletProvider,
    usePeraProvider,
} from '@perawallet/wallet-extension-provider'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { QueryProvider } from '@providers/QueryProvider'
import { VaultGate, CreatePasswordScreen } from '@modules/vault'
import { OnboardingStackNavigator } from '@modules/onboarding/routes'
import { FullScreenLoadingView } from '@components/FullScreenLoadingView'
import { PWText, PWView } from '@components/core'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useLanguage } from '@hooks/useLanguage'
import { getTheme } from '@theme/theme'
import { createCrashReportingErrorReporter } from '@perawallet/wallet-extension-platform'
import { useWebAppShell } from './useWebAppShell'

// Platform hydration is complete before AppShell mounts (App.web.tsx ensures
// this), so getProvider() is safe to call at module scope here.
const persister = createAsyncStoragePersister({
    storage: getProvider().keyValueStorage,
    serialize: algorandSafeQuerySerialize,
    deserialize: algorandSafeQueryParse,
})

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
updateQueryHeaders()

const useMainHomePlaceholderStyles = makeStyles(theme => ({
    container: {
        flex: 1,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        padding: theme.spacing.md,
    },
    title: {
        marginBottom: theme.spacing.sm,
    },
    address: {
        color: theme.colors.textGray,
    },
}))

const useApprovalPlaceholderStyles = makeStyles(() => ({
    container: {
        flex: 1,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    },
}))

// M2 "it worked" proof — M3 replaces with real TabBar.
const MainHomePlaceholder = (): React.JSX.Element => {
    const styles = useMainHomePlaceholderStyles()
    const { t } = useLanguage()
    const account = useSelectedAccount()

    return (
        <PWView style={styles.container}>
            <PWText style={styles.title}>{t('vault.home.title')}</PWText>
            {account && (
                <>
                    <PWText>{account.name}</PWText>
                    <PWText
                        style={styles.address}
                        testID='account-home-address'
                    >
                        {account.address}
                    </PWText>
                </>
            )}
        </PWView>
    )
}

const ApprovalPlaceholder = (): React.JSX.Element => {
    const { t } = useLanguage()
    const styles = useApprovalPlaceholderStyles()

    return (
        <PWView style={styles.container}>
            <PWText testID='approval-placeholder'>
                {t('vault.approval.placeholder')}
            </PWText>
        </PWView>
    )
}

const ShellRouter = (): React.JSX.Element => {
    const { shellState } = useWebAppShell()

    switch (shellState) {
        case 'resolving': {
            return <FullScreenLoadingView />
        }
        case 'approval-placeholder': {
            return <ApprovalPlaceholder />
        }
        case 'create-password': {
            return (
                <CreatePasswordScreen
                    onDone={() => {
                        // no-op: createVault flips the session state, which
                        // useVaultLockState observes and re-routes to onboarding.
                    }}
                />
            )
        }
        case 'onboarding': {
            return (
                <NavigationContainer>
                    <OnboardingStackNavigator />
                </NavigationContainer>
            )
        }
        case 'main': {
            return <MainHomePlaceholder />
        }
    }
}

const AppShellContent = (): React.JSX.Element => {
    const provider = usePeraProvider()
    const isDarkMode = useIsDarkMode()
    const theme = getTheme(isDarkMode ? 'dark' : 'light')

    React.useEffect(() => {
        logger.setErrorReporter(
            createCrashReportingErrorReporter(provider.crashReporting),
        )
        return () => {
            logger.setErrorReporter(undefined)
        }
    }, [provider])

    return (
        <ThemeProvider theme={theme}>
            <SafeAreaProvider>
                <GestureHandlerRootView>
                    <KeyboardProvider>
                        <QueryProvider persister={persister}>
                            {/* VaultGate OUTERMOST inside providers: locked ⇒ nothing else renders */}
                            <VaultGate>
                                <ShellRouter />
                            </VaultGate>
                        </QueryProvider>
                    </KeyboardProvider>
                </GestureHandlerRootView>
            </SafeAreaProvider>
        </ThemeProvider>
    )
}

export const AppShell = (): React.JSX.Element => (
    <PeraWalletProvider>
        <AppShellContent />
    </PeraWalletProvider>
)
