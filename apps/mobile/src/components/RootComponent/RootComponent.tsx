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

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { AppState } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { MainRoutes } from '@routes/index'
import { OverlayErrorFallback } from './OverlayErrorFallback'
import { useStyles } from './styles'
import { PWText, PWView } from '@components/core'
import { OfflineBanner } from '@components/OfflineBanner'
import { NETWORK_LABEL_KEYS } from '@constants/network-labels'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ErrorBoundary from 'react-native-error-boundary'
import { useErrorToast } from '@hooks/useErrorToast'
import { useDeviceRegistration } from '@perawallet/wallet-core-device'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    useAllAccounts,
    useSyncNewAccounts,
} from '@perawallet/wallet-core-accounts'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { useNeedsMigration } from '@perawallet/wallet-core-migrate'
import { useReplayNotificationMutes } from '@perawallet/wallet-core-messages'
import { useNetworkStatusListener } from '@modules/network'
import { WebViewOverlay } from '@modules/webview'
import { PromptContainer } from '@modules/prompts'
import { useLanguage } from '@hooks/useLanguage'
import { useNotificationDeeplinkListener } from '@hooks/useNotificationDeeplinkListener'
import { useNotificationReceivedListener } from '@hooks/useNotificationReceivedListener'
import { useNetworkSwitchInvalidation } from '@hooks/useNetworkSwitchInvalidation'
import { WalletConnectProvider } from '@modules/walletconnect/providers/WalletConnectProvider'
import { PairingProgressOverlay } from '@modules/walletconnect/components/PairingProgressOverlay'
import { useTokenListener } from '@modules/token'
import { AutoLockGuard } from '@modules/security/components/AutoLockGuard/AutoLockGuard'
import { SigningOverlays } from '@modules/signing/components/SigningOverlays'
import { MultisigOverlays } from '@modules/multisig/components/MultisigOverlays'
import { SwapOverlays } from '@modules/swap/components/SwapOverlays'
import { useSyncMultisigAccountsOnNetworkSwitch } from '@modules/multisig/hooks/useSyncMultisigAccountsOnNetworkSwitch'
import {
    getAppStatePlatform,
    getPollingTransitionAction,
} from '@utils/app-state'
import { getSyncService } from '@perawallet/wallet-core-background'
import { config } from '@perawallet/wallet-core-config'

export type RootComponentProps = {
    fcmToken: Nullable<string>
}

// These overlays render outside the main content's error boundary and host
// signing/multisig/swap (money) flows, so an unhandled render-throw here
// would unwind the whole app. Contain it: log the crash and render nothing
// while the fallback schedules a boundary reset (see OverlayErrorFallback)
// so the overlays come back instead of staying dead until app restart.
const handleOverlayError = (error: string | Error) => {
    logger.critical(error, { source: 'RootOverlaysErrorBoundary' })
}

const RootContentContainer = ({ fcmToken }: RootComponentProps) => {
    const { isMainnet, network } = useNetwork()
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { showError } = useErrorToast()
    const { t } = useLanguage()

    // Initialize network status listener (replaces NetworkStatusProvider)
    useNetworkStatusListener()

    // Initialize FCM token (replaces TokenInitializer)
    useTokenListener(fcmToken)

    // Route tapped push notifications through the deeplink dispatcher.
    useNotificationDeeplinkListener()

    // Refresh the notification badge/inbox as soon as a foreground push lands.
    useNotificationReceivedListener()

    const handleBoundaryError = (error: string | Error) => {
        logger.critical(error, {
            source: 'RootComponentErrorBoundary',
        })

        showError(error, t('errors.general.title'))
    }

    return (
        <ErrorBoundary onError={handleBoundaryError}>
            <PWView style={styles.container}>
                {!isMainnet && (
                    <PWView style={styles.testnetBar}>
                        <PWText style={styles.testnetText}>
                            {t(NETWORK_LABEL_KEYS[network])}
                        </PWText>
                    </PWView>
                )}

                <GestureHandlerRootView>
                    <MainRoutes />
                    <WebViewOverlay />
                    {/* After WebViewOverlay so a deep-link pairing scrim
                        paints above the in-app browser too. */}
                    <PairingProgressOverlay />
                    {/* Blocking prompts (T&C re-acceptance, PIN setup) paint
                        above the navigator and the tab bar. Inside
                        AutoLockGuard's children so the lock overlay still
                        hides them. */}
                    <PromptContainer />
                </GestureHandlerRootView>
            </PWView>
        </ErrorBoundary>
    )
}

const DeviceRegistrar = ({ addresses }: { addresses: string[] }) => {
    const replayNotificationMutes = useReplayNotificationMutes()
    useDeviceRegistration(addresses, {
        onDeviceCreated: replayNotificationMutes,
    })
    return null
}

export const RootComponent = ({ fcmToken }: RootComponentProps) => {
    const accounts = useAllAccounts()

    const appState = useRef(AppState.currentState)
    const appStatePlatform = useRef(getAppStatePlatform()).current

    // The Zustand `accounts` array gets a new reference on every store write
    // (incl. background sync ticks). Effects that only care about the *set* of
    // accounts must depend on a stable scalar, otherwise they re-fire on every
    // tick and the sync service re-arms in a tight loop.
    const addresses = useMemo(
        () => accounts?.map(account => account.address) ?? [],
        [accounts],
    )
    const hasAccounts = addresses.length > 0

    const { isChecking, needsMigration } = useNeedsMigration()
    const migrationInProgress = isChecking || needsMigration
    useSyncMultisigAccountsOnNetworkSwitch()
    // Accounts added mid-session (import/create/watch/discovery) get an
    // immediate fetch + asset/price enrichment — the gated background poll
    // never picks up an account whose activity predates its checkpoint.
    // Gated on migration like DeviceRegistrar below: syncing before the
    // migrated device id lands caches favorites as false (PERA-4564).
    useSyncNewAccounts({ isEnabled: !migrationInProgress })

    const runSyncAction = useCallback((action: 'start' | 'stop') => {
        try {
            const syncService = getSyncService()
            if (action === 'start') {
                syncService.start()
            } else {
                syncService.stop()
            }
        } catch (error) {
            logger.error('Sync action failed in RootComponent', {
                source: 'RootComponent',
                action,
                error,
            })
        }
    }, [])

    useNetworkSwitchInvalidation()

    useEffect(() => {
        // Hold the background poll until migration finishes: its initial
        // full pass would otherwise fetch assets before the migrated device
        // id is written and cache favorites as false (PERA-4564).
        if (!hasAccounts || migrationInProgress) {
            runSyncAction('stop')
            return
        }
        if (!config.pollingEnabled) return

        runSyncAction('start')

        const subscription = AppState.addEventListener(
            'change',
            nextAppState => {
                const previousState = appState.current
                const action = getPollingTransitionAction(
                    previousState,
                    nextAppState,
                    appStatePlatform,
                )

                if (action === 'start') {
                    runSyncAction('start')
                } else if (action === 'stop') {
                    runSyncAction('stop')
                }

                appState.current = nextAppState
            },
        )

        return () => {
            runSyncAction('stop')
            subscription.remove()
        }
    }, [appStatePlatform, hasAccounts, migrationInProgress, runSyncAction])

    return (
        <>
            <BottomSheetModalProvider>
                {!migrationInProgress && (
                    <DeviceRegistrar addresses={addresses} />
                )}
                <AutoLockGuard>
                    <WalletConnectProvider>
                        <RootContentContainer fcmToken={fcmToken} />
                    </WalletConnectProvider>
                    <ErrorBoundary
                        onError={handleOverlayError}
                        FallbackComponent={OverlayErrorFallback}
                    >
                        <SigningOverlays />
                        <MultisigOverlays />
                        <SwapOverlays />
                    </ErrorBoundary>
                </AutoLockGuard>
            </BottomSheetModalProvider>
            {/* Global offline indicator. Mounted as the LAST node in the root
                tree so it paints above navigation, bottom-sheet modals, and the
                AutoLockGuard PIN overlay (which itself uses zIndex.max). Order
                here is load-bearing — keep <OfflineBanner /> last. */}
            <OfflineBanner />
        </>
    )
}
