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

import { config } from '@perawallet/wallet-core-config'
import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { MainRoutes } from '@routes/index'
import { useStyles } from './styles'
import { PWText, PWView } from '@components/core'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ErrorBoundary from 'react-native-error-boundary'
import { useToast } from '@hooks/useToast'
import { useDevice } from '@perawallet/wallet-core-device'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { useNetworkStatus, useNetworkStatusListener } from '@modules/network'
import { WebViewOverlay } from '@modules/webview'
import { useCallback } from 'react'
import { useLanguage } from '@hooks/useLanguage'
import { WalletConnectProvider } from '@modules/walletconnect/providers/WalletConnectProvider'
import { useTokenListener } from '@modules/token'
import { AutoLockGuard } from '@modules/security/components/AutoLockGuard/AutoLockGuard'
import { SigningOverlays } from '@modules/signing/components/SigningOverlays'
import {
    getAppStatePlatform,
    getPollingTransitionAction,
} from '@utils/app-state'
import { getSyncService } from '@perawallet/wallet-core-background'

export type RootComponentProps = {
    fcmToken: Nullable<string>
}

const RootContentContainer = ({ fcmToken }: RootComponentProps) => {
    const { isTestnet } = useNetwork()
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { hasInternet } = useNetworkStatus()
    const { showToast } = useToast()
    const { t } = useLanguage()

    // Initialize network status listener (replaces NetworkStatusProvider)
    useNetworkStatusListener()

    // Initialize FCM token (replaces TokenInitializer)
    useTokenListener(fcmToken)

    const showError = (error: string | Error) => {
        logger.critical(error, {
            source: 'RootComponentErrorBoundary',
        })

        showToast({
            title: 'Error',
            body: config.debugEnabled
                ? `Details: ${error}`
                : 'An error has occured, please try again.',
            type: 'error',
        })
    }

    return (
        <ErrorBoundary onError={showError}>
            <PWView style={styles.container}>
                {isTestnet && (
                    <PWView style={styles.testnetBar}>
                        <PWText style={styles.testnetText}>Testnet</PWText>
                    </PWView>
                )}

                {!hasInternet && (
                    <PWView style={styles.offlineTextContainer}>
                        <PWText style={styles.offlineText}>
                            {t('common.offline_mode')}
                        </PWText>
                    </PWView>
                )}

                <GestureHandlerRootView>
                    <MainRoutes />
                    <WebViewOverlay />
                </GestureHandlerRootView>
            </PWView>
        </ErrorBoundary>
    )
}

export const RootComponent = ({ fcmToken }: RootComponentProps) => {
    const { network } = useNetwork()
    const { registerDevice } = useDevice()
    const accounts = useAllAccounts()

    const appState = useRef(AppState.currentState)
    const appStatePlatform = useRef(getAppStatePlatform()).current

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

    // Device registration and query invalidation — re-runs when network or accounts change
    useEffect(() => {
        const addresses = accounts?.map(account => account.address) ?? []
        registerDevice(addresses)

        // Invalidate all synced queries so the UI re-reads from the DB for the new network
        try {
            getSyncService().invalidateQueries()
        } catch {
            // SyncService not yet initialized
        }
    }, [accounts, network, registerDevice])

    // Sync lifecycle — NOT dependent on network so switching networks won't restart the sync
    useEffect(() => {
        const addresses = accounts?.map(account => account.address) ?? []

        if (!addresses.length) {
            runSyncAction('stop')
        } else if (config.pollingEnabled) {
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
        }
    }, [appStatePlatform, accounts, runSyncAction])

    return (
        <BottomSheetModalProvider>
            <AutoLockGuard>
                <WalletConnectProvider>
                    <RootContentContainer fcmToken={fcmToken} />
                </WalletConnectProvider>
                <SigningOverlays />
            </AutoLockGuard>
        </BottomSheetModalProvider>
    )
}
