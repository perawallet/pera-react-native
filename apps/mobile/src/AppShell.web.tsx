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

import { initDecimalConfig, logger } from '@perawallet/wallet-core-shared'
// Initialize Decimal.js configuration before any other imports that may use it
initDecimalConfig()

import React from 'react'
import './i18n'
// Side-effect import: binds the bottom-sheet registry before the React tree
// mounts so non-React callers (deep links) can request sheets from boot.
import '@modules/bottom-sheet/registrations'
import { BottomSheetManager } from '@modules/bottom-sheet'
import { ThemeProvider, makeStyles } from '@rneui/themed'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { NotifierWrapper } from 'react-native-notifier'
import {
    NavigationContainer,
    useNavigationContainerRef,
    type ParamListBase,
} from '@react-navigation/native'
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
import { QueryProvider } from '@providers/QueryProvider'
import {
    VaultGate,
    CreatePasswordScreen,
    useAutoLockActivity,
    useVaultLockState,
} from '@modules/vault'
import { OnboardingStackNavigator } from '@modules/onboarding/routes'
import { FullScreenLoadingView } from '@components/FullScreenLoadingView'
import { EmptyView } from '@components/EmptyView/EmptyView'
import { BaseErrorBoundary } from '@components/BaseErrorBoundary'
import { PWButton, PWText, PWView } from '@components/core'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useLanguage } from '@hooks/useLanguage'
import { getTheme, getNavigationTheme } from '@theme/theme'
import { createCrashReportingErrorReporter } from '@perawallet/wallet-extension-platform'
import { WebMainRoutes } from '@routes/WebMainRoutes.web'
import { useOnboardingExpandedFlowNavigation } from '@routes/useExpandedFlowNavigation.web'
import { DappRequestRoutes } from '@modules/dapp'
import { TestnetIndicator } from '@components/TestnetIndicator'
import { OfflineBanner } from '@components/OfflineBanner'
import { initNetworkStatus, useNetworkStatusListener } from '@modules/network'
import { useNetworkSwitchInvalidation } from '@hooks/useNetworkSwitchInvalidation'
import { WEB_EXPANDED_CARD_MAX_WIDTH } from '@constants/ui'
import { useWebAppShell } from './useWebAppShell.web'
import { updateQueryHeaders } from './bootstrap/query-headers'

// Platform hydration is complete before AppShell mounts (App.web.tsx ensures
// this), so getProvider() is safe to call at module scope here.
const persister = createAsyncStoragePersister({
    storage: getProvider().keyValueStorage,
    serialize: algorandSafeQuerySerialize,
    deserialize: algorandSafeQueryParse,
})

updateQueryHeaders()

// App.web.tsx must stay free of store-bearing imports (BOOT-ORDER CONTRACT), so
// this is the earliest safe point, still before QueryProvider mounts. Without
// it there is no onlineManager binding and every query treats the app as online.
void initNetworkStatus()

// Theme-aware paint for the whole app area, below ThemeProvider so it sees
// in-app overrides; build.mjs's global CSS is only the pre-mount fallback.
// `card` caps content to a popup-like width: the UI was designed for a 360px
// popup. PWBottomSheet.web applies the same cap, since gorhom-on-web portals to document.body.
const useAppShellRootStyles = makeStyles(theme => ({
    root: {
        flex: 1,
        backgroundColor: theme.colors.layerGrayLighter,
    },
    card: {
        flex: 1,
        width: '100%',
        maxWidth: WEB_EXPANDED_CARD_MAX_WIDTH,
        alignSelf: 'center',
        backgroundColor: theme.colors.background,
    },
}))

const useApprovalPlaceholderStyles = makeStyles(() => ({
    container: {
        flex: 1,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    },
}))

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

// Mounts INSIDE QueryProvider (and outside VaultGate so the lock never unmounts
// it): useNetworkSwitchInvalidation reads the query client from context, and
// calling it from the shell body crashes at boot with "No QueryClient set".
const NetworkSwitchInvalidation = (): null => {
    useNetworkSwitchInvalidation()
    return null
}

const ShellRouter = (): React.JSX.Element => {
    const { shellState, fcmToken } = useWebAppShell()
    const { t } = useLanguage()
    const isDarkMode = useIsDarkMode()
    // Not the shared `routes/navigationRef`: global handlers (deep links,
    // notification taps) only know main-shell routes, and binding it here would
    // turn their isReady()===false no-op during onboarding into a bad navigate.
    const onboardingNavigationRef = useNavigationContainerRef<ParamListBase>()
    const handleOnboardingReady = useOnboardingExpandedFlowNavigation(
        (screen, params) => {
            onboardingNavigationRef.navigate(screen, params)
        },
    )

    switch (shellState) {
        case 'resolving': {
            return <FullScreenLoadingView />
        }
        case 'approval-placeholder': {
            return <ApprovalPlaceholder />
        }
        case 'dapp-request': {
            return <DappRequestRoutes />
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
                // Themed so React Navigation's DefaultTheme grey background
                // doesn't paint the onboarding scene.
                <NavigationContainer
                    ref={onboardingNavigationRef}
                    theme={getNavigationTheme(isDarkMode ? 'dark' : 'light')}
                    onReady={handleOnboardingReady}
                >
                    <OnboardingStackNavigator />
                    <BottomSheetManager />
                </NavigationContainer>
            )
        }
        case 'main': {
            // WebMainRoutes mounts its own BottomSheetManager inside its
            // NavigationContainer (native parity) — do not add another here.
            return <WebMainRoutes fcmToken={fcmToken} />
        }
        case 'error': {
            return (
                <EmptyView
                    title={t('app.initialization_failed.title')}
                    body={t('app.initialization_failed.body')}
                />
            )
        }
    }
}

// Sibling of VaultGate, not a child: activity on the unlock screen must NOT
// re-arm auto-lock, or an attacker at the lock screen gets a sliding window.
// useVaultLockState's isUnlocked gate makes useAutoLockActivity a no-op there.
const ActivityAutoLock = (): null => {
    const { isUnlocked } = useVaultLockState()
    useAutoLockActivity(isUnlocked === true)
    return null
}

// A crypto wallet must never white-screen silently, so this renders a themed
// reload screen. It lives INSIDE ThemeProvider so its makeStyles have a theme.
type ShellErrorFallbackProps = {
    reset: () => void
}

const ShellErrorFallback = ({
    reset,
}: ShellErrorFallbackProps): React.JSX.Element => {
    const { t } = useLanguage()
    const rootStyles = useAppShellRootStyles()

    return (
        <PWView style={rootStyles.root}>
            <PWView style={rootStyles.card}>
                <EmptyView
                    title={t('app.initialization_failed.title')}
                    body={t('app.initialization_failed.body')}
                    testID='shell-error-fallback'
                    button={
                        <PWButton
                            variant='primary'
                            title={t('common.retry.label')}
                            testID='shell-error-reload'
                            onPress={() => {
                                reset()
                                if (typeof window !== 'undefined') {
                                    window.location.reload()
                                }
                            }}
                        />
                    }
                />
            </PWView>
        </PWView>
    )
}

const WebShellErrorBoundary = ({
    children,
}: {
    children: React.ReactNode
}): React.JSX.Element => {
    const { t } = useLanguage()

    return (
        <BaseErrorBoundary
            t={t}
            fallback={(_error, reset) => <ShellErrorFallback reset={reset} />}
        >
            {children}
        </BaseErrorBoundary>
    )
}

// Splitting this out of AppShellContent is load-bearing: a makeStyles hook in
// the same component that *renders* ThemeProvider runs with no theme context
// and throws `Cannot read properties of undefined (reading 'colors')`.
const AppShellThemedRoot = (): React.JSX.Element => {
    const rootStyles = useAppShellRootStyles()

    // Native does this in RootComponent, which the web shell replaces — so
    // without it here the reachability probe never runs and onlineManager
    // keeps whatever seed initNetworkStatus left.
    useNetworkStatusListener()

    return (
        <SafeAreaProvider>
            <GestureHandlerRootView style={rootStyles.root}>
                <PWView style={rootStyles.card}>
                    <TestnetIndicator />
                    <KeyboardProvider>
                        <NotifierWrapper
                            componentProps={{
                                ContainerComponent: SafeAreaView,
                            }}
                        >
                            <QueryProvider persister={persister}>
                                <NetworkSwitchInvalidation />
                                {/* VaultGate OUTERMOST inside providers: locked ⇒ nothing else renders */}
                                <VaultGate>
                                    <ShellRouter />
                                </VaultGate>
                                <ActivityAutoLock />
                            </QueryProvider>
                        </NotifierWrapper>
                    </KeyboardProvider>
                    {/* Same contract as RootComponent's: LAST node inside the
                        card so it paints above navigation and sheets. */}
                    <OfflineBanner />
                </PWView>
            </GestureHandlerRootView>
        </SafeAreaProvider>
    )
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
            <WebShellErrorBoundary>
                <AppShellThemedRoot />
            </WebShellErrorBoundary>
        </ThemeProvider>
    )
}

export const AppShell = (): React.JSX.Element => (
    <PeraWalletProvider>
        <AppShellContent />
    </PeraWalletProvider>
)
