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

import { AppState } from 'react-native'
import { onlineManager } from '@tanstack/react-query'
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'
import { reconnectAllConnectors } from '../connection'
import { getAppStatePlatform, isForegroundTransition } from '../utils/app-state'

// Trailing delay after an offline→online edge, so a flapping link (captive
// portal, cell handover) collapses into one sweep once connectivity settles.
const NETWORK_RECONNECT_DEBOUNCE_MS = 1000

/**
 * The OS suspends each session's socket while backgrounded, and v1's own
 * network-regain reconnect is dead code in React Native (its NetworkMonitor
 * binds `window` 'online' events RN never emits), so both edges are swept here.
 * Re-entrant: concurrent sweeps share recreations via `ensureConnectorReady`.
 */
export const startReconnectSweep = (): (() => void) => {
    const platform = getAppStatePlatform()
    let previousAppState: Maybe<string> = AppState.currentState
    let wasOnline = onlineManager.isOnline()
    let debounceTimer: Nullable<ReturnType<typeof setTimeout>> = null

    const clearPendingSweep = (): void => {
        if (debounceTimer !== null) {
            clearTimeout(debounceTimer)
            debounceTimer = null
        }
    }

    const appStateSubscription = AppState.addEventListener(
        'change',
        nextAppState => {
            const priorState = previousAppState
            previousAppState = nextAppState

            if (isForegroundTransition(priorState, nextAppState, platform)) {
                reconnectAllConnectors()
            }
        },
    )

    const unsubscribeOnline = onlineManager.subscribe(isOnline => {
        const cameOnline = !wasOnline && isOnline
        wasOnline = isOnline

        if (!isOnline) {
            // Sweeping into a dead link is pointless; wait for the next online edge.
            clearPendingSweep()
            return
        }
        if (!cameOnline) return

        clearPendingSweep()
        debounceTimer = setTimeout(() => {
            debounceTimer = null
            reconnectAllConnectors()
        }, NETWORK_RECONNECT_DEBOUNCE_MS)
    })

    return () => {
        appStateSubscription.remove()
        unsubscribeOnline()
        clearPendingSweep()
    }
}
