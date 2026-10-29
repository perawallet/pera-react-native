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

import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { OverlayErrorFallback } from './OverlayErrorFallback'
import { OfflineBanner } from '@components/OfflineBanner'
import ErrorBoundary from 'react-native-error-boundary'
import {
    useAllAccounts,
    useSyncNewAccounts,
} from '@perawallet/wallet-core-accounts'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { useNeedsMigration } from '@perawallet/wallet-core-migrate'
import { DeviceRegistrar } from '@components/DeviceRegistrar'
import { useNetworkSwitchInvalidation } from '@hooks/useNetworkSwitchInvalidation'
import { useImageMemoryRelease } from '@hooks/useImageMemoryRelease'
import { ConnectionsProvider } from '@modules/connections/shell'
import { AutoLockGuard } from '@modules/security/shell'
import { SigningOverlays } from '@modules/signing/shell'
import {
    useSyncMultisigAccountsOnNetworkSwitch,
    MultisigOverlays,
} from '@modules/multisig/shell'
import { SwapOverlays } from '@modules/swap/shell'
import {
    getAppStatePlatform,
    getPollingTransitionAction,
} from '@utils/app-state'
import { getSyncService } from '@perawallet/wallet-core-background'
import { useBackupSyncLifecycle } from '@modules/cloud-backup'
import { useWidgetSnapshotSync } from '@modules/widgets/shell'
import { config } from '@perawallet/wallet-core-config'
import { RootContentContainer } from './RootContentContainer'

export type RootComponentProps = {
    fcmToken: Nullable<string>
}

// These overlays host signing/multisig/swap (money) flows outside the main
// content's error boundary, so an unhandled render-throw would unwind the whole
// app. Contain it; OverlayErrorFallback schedules a reset so they come back.
const handleOverlayError = (error: string | Error) => {
    logger.critical(error, { source: 'RootOverlaysErrorBoundary' })
}

export const RootComponent = ({ fcmToken }: RootComponentProps) => {
    const accounts = useAllAccounts()

    const appState = useRef(AppState.currentState)
    const appStatePlatform = useRef(getAppStatePlatform()).current

    // The Zustand `accounts` array gets a new reference on every store write
    // (incl. sync ticks); depending on it directly re-arms the sync service in a
    // tight loop, so effects key on a stable scalar instead.
    const hasAccounts = (accounts?.length ?? 0) > 0

    const { isChecking, needsMigration } = useNeedsMigration()
    const migrationInProgress = isChecking || needsMigration
    useSyncMultisigAccountsOnNetworkSwitch()
    // Accounts added mid-session get an immediate fetch: the background poll never
    // picks up an account whose activity predates its checkpoint. Gated on
    // migration because syncing before the migrated device id lands caches favorites as false.
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
    useImageMemoryRelease()

    useBackupSyncLifecycle()
    useWidgetSnapshotSync()

    useEffect(() => {
        // Hold the background poll until migration finishes: its initial
        // full pass would otherwise fetch assets before the migrated device
        // id is written and cache favorites as false.
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
                {!migrationInProgress && <DeviceRegistrar />}
                <AutoLockGuard>
                    {/* The app's single connection registry: it owns every
                        handler's lifecycle, so exactly one may be mounted. */}
                    <ConnectionsProvider>
                        <RootContentContainer fcmToken={fcmToken} />
                    </ConnectionsProvider>
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
            {/* LAST node in the root tree so it paints above navigation, sheet
                modals and the AutoLockGuard PIN overlay (zIndex.max). Keep it last. */}
            <OfflineBanner />
        </>
    )
}
