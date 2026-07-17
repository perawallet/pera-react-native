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
import {
    getSurface,
    openExpandedTab,
} from '@perawallet/wallet-extension-platform-chrome'
import { WebMainRoutes } from '@routes/WebMainRoutes'
import { DappRequestRoutes } from '@modules/dapp'
import { useWebAppShell } from './useWebAppShell'
import { updateQueryHeaders } from './bootstrap/query-headers'

// Platform hydration is complete before AppShell mounts (App.web.tsx ensures
// this), so getProvider() is safe to call at module scope here.
const persister = createAsyncStoragePersister({
    storage: getProvider().keyValueStorage,
    serialize: algorandSafeQuerySerialize,
    deserialize: algorandSafeQueryParse,
})

updateQueryHeaders()

// Authoritative theme-aware paint for the entire app area: below
// ThemeProvider so it sees in-app theme overrides (useSettings().theme /
// useIsDarkMode), not just the OS theme. Covers any gap individual screens
// leave uncovered (e.g. the welcome/onboarding screen, or content shorter
// than the popup/tab viewport) so nothing falls through to the unstyled
// html/body grey. The build.mjs global CSS paints html/body as a pre-mount
// fallback only; this View is what's authoritative once React has mounted.
const useAppShellRootStyles = makeStyles(theme => ({
    root: {
        flex: 1,
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

const useOnboardingTabPromptStyles = makeStyles(theme => ({
    container: {
        flex: 1,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        padding: theme.spacing.lg,
    },
    title: {
        textAlign: 'center' as const,
        marginBottom: theme.spacing.sm,
    },
    body: {
        textAlign: 'center' as const,
        marginBottom: theme.spacing.lg,
    },
}))

// Blur-fragile onboarding must not run in the 360x600 popup (design spec):
// the popup shows a CTA that opens the full tab instead of the real stack.
const OnboardingTabPrompt = (): React.JSX.Element => {
    const styles = useOnboardingTabPromptStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.container}>
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('vault.expanded.onboarding_title')}
            </PWText>
            <PWText style={styles.body}>
                {t('vault.expanded.onboarding_body')}
            </PWText>
            <PWButton
                variant='primary'
                title={t('vault.expanded.onboarding_cta')}
                testID='open-onboarding-tab'
                onPress={() => {
                    void openExpandedTab()
                }}
            />
        </PWView>
    )
}

const ShellRouter = (): React.JSX.Element => {
    const { shellState } = useWebAppShell()
    const { t } = useLanguage()
    const isDarkMode = useIsDarkMode()

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
            if (getSurface() === 'popup') {
                return <OnboardingTabPrompt />
            }
            return (
                // Theme the container so React Navigation's DefaultTheme grey
                // background (rgb(242,242,242)) doesn't paint the onboarding
                // scene — same fix as WebMainRoutes and the sheet flows.
                <NavigationContainer
                    theme={getNavigationTheme(isDarkMode ? 'dark' : 'light')}
                >
                    <OnboardingStackNavigator />
                    <BottomSheetManager />
                </NavigationContainer>
            )
        }
        case 'main': {
            // WebMainRoutes mounts its own BottomSheetManager inside its
            // NavigationContainer (native parity) — do not add another here.
            return <WebMainRoutes />
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

    return (
        <SafeAreaProvider>
            <GestureHandlerRootView style={rootStyles.root}>
                <KeyboardProvider>
                    <NotifierWrapper
                        componentProps={{
                            ContainerComponent: SafeAreaView,
                        }}
                    >
                        <QueryProvider persister={persister}>
                            {/* VaultGate OUTERMOST inside providers: locked ⇒ nothing else renders */}
                            <VaultGate>
                                <ShellRouter />
                            </VaultGate>
                            <ActivityAutoLock />
                        </QueryProvider>
                    </NotifierWrapper>
                </KeyboardProvider>
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
