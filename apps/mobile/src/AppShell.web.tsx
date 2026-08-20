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
// Side-effect: binds every entry in the bottom-sheet manager's typed
// registry (see modules/bottom-sheet/registrations.ts) before anything in
// the React tree mounts, so deep links and other non-React callers can
// safely call useBottomSheetStore.getState().requestByType(...) from the
// moment the app boots.
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
import { registerWcStoreRehydration } from './bootstrap/wcStoreRehydration.web'

// Platform hydration is complete before AppShell mounts (App.web.tsx ensures
// this), so getProvider() is safe to call at module scope here.
const persister = createAsyncStoragePersister({
    storage: getProvider().keyValueStorage,
    serialize: algorandSafeQuerySerialize,
    deserialize: algorandSafeQueryParse,
})

updateQueryHeaders()

// Native does this at App.tsx module scope; the extension can't, because
// App.web.tsx must stay free of store-bearing static imports (see its
// BOOT-ORDER CONTRACT). Here is the earliest boot-order-safe equivalent, and
// still before QueryProvider mounts below — which is what the seeding is for,
// so early queries don't fire-and-fail against a dead link. Without it web had
// no onlineManager binding at all and every query treated the app as online.
void initNetworkStatus()

// Boot-order-safe here for the same reason `persister` above is: App.web.tsx
// only dynamically imports this module after `hydratePlatform()` resolves, so
// `getProvider()` is ready. Registered once per UI realm (popup, expanded tab,
// approval surface).
registerWcStoreRehydration()

// Authoritative theme-aware paint for the whole app area. Sits below
// ThemeProvider so it sees in-app theme overrides, not just the OS theme, and
// covers gaps individual screens leave so nothing falls through to unstyled
// html/body grey. build.mjs's global CSS is only the pre-mount fallback.
//
// `card` caps content to a popup-like width and centers it — the UI was
// designed for a 360px popup and looks broken stretched across a desktop tab.
// The cap never binds on the popup/approval surfaces, so `root`'s tone is only
// ever visible on the expanded one; no surface check needed.
//
// PWBottomSheet.web applies the same cap to its own stage, since gorhom-on-web
// portals to document.body and would otherwise bypass this card.
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

// Same RootComponent-replacement contract as useNetworkStatusListener below:
// the single owner of the on-network-switch invalidation lives in this shell.
// It mounts INSIDE QueryProvider (and outside VaultGate, so it's never
// unmounted by the lock) because useNetworkSwitchInvalidation reads the query
// client from context since #1336 — calling it from the shell body crashed
// every web surface at boot with "No QueryClient set".
const NetworkSwitchInvalidation = (): null => {
    useNetworkSwitchInvalidation()
    return null
}

const ShellRouter = (): React.JSX.Element => {
    const { shellState, fcmToken } = useWebAppShell()
    const { t } = useLanguage()
    const isDarkMode = useIsDarkMode()
    // Its own ref rather than the shared `routes/navigationRef`: that one is
    // read by global handlers (deep links, notification taps) that only know
    // main-shell routes, and binding it here would turn their isReady()===false
    // no-op during onboarding into a navigate at a route that doesn't exist.
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
                // Theme the container so React Navigation's DefaultTheme grey
                // background (rgb(242,242,242)) doesn't paint the onboarding
                // scene — same fix as WebMainRoutes and the sheet flows.
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

// Sibling of VaultGate (not a child): activity on the unlock screen itself
// must NOT re-arm auto-lock — an attacker with the device open to the lock
// screen shouldn't get a sliding window extension. useVaultLockState's
// isUnlocked gate handles that (null/false ⇒ useAutoLockActivity no-ops).
const ActivityAutoLock = (): null => {
    const { isUnlocked } = useVaultLockState()
    useAutoLockActivity(isUnlocked === true)
    return null
}

// Recoverable fallback for any uncaught throw in the shell tree. A crypto
// wallet must never white-screen silently, so this renders a themed
// "something went wrong" screen with a reload affordance instead of letting
// React unmount the whole root. It lives INSIDE ThemeProvider so its own
// makeStyles/EmptyView have a theme to read.
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

// Everything under ThemeProvider: useAppShellRootStyles and every other
// makeStyles hook in the tree resolve a theme here. Splitting this out of
// AppShellContent is load-bearing — calling a makeStyles hook in the same
// component that *renders* ThemeProvider runs it with no theme context and
// throws `Cannot read properties of undefined (reading 'colors')`.
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
