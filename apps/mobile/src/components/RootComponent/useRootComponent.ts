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
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'
import { getSyncService } from '@perawallet/wallet-core-background'
import { config } from '@perawallet/wallet-core-config'
import {
    getAppStatePlatform,
    getPollingTransitionAction,
} from '@utils/app-state'

export type UseRootComponentProps = {
    migrationInProgress: boolean
}

export const useRootComponent = ({
    migrationInProgress,
}: UseRootComponentProps): void => {
    const accounts = useAllAccounts()

    const appState = useRef(AppState.currentState)
    // Since the poll last started. iOS can come back through `inactive`, so
    // the previous state alone can't tell a background stay from a blip.
    const hasBeenInBackground = useRef(false)
    const appStatePlatform = useRef(getAppStatePlatform()).current

    // The Zustand `accounts` array gets a new reference on every store write
    // (incl. sync ticks); depending on it directly re-arms the sync service in a
    // tight loop, so effects key on a stable scalar instead.
    const hasAccounts = (accounts?.length ?? 0) > 0

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

    const markScopesStale = useCallback(() => {
        try {
            getSyncService().markAllScopesStale()
        } catch (error) {
            logger.error('Marking sync scopes stale failed in RootComponent', {
                source: 'RootComponent',
                error,
            })
        }
    }, [])

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

                if (nextAppState === 'background') {
                    hasBeenInBackground.current = true
                }

                if (action === 'start') {
                    // Only a real background stay: iOS goes inactive for a
                    // Face ID prompt or Control Center, and reading every
                    // network on each of those would be wasted work.
                    if (hasBeenInBackground.current) {
                        hasBeenInBackground.current = false
                        markScopesStale()
                    }
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
    }, [
        appStatePlatform,
        hasAccounts,
        markScopesStale,
        migrationInProgress,
        runSyncAction,
    ])
}
