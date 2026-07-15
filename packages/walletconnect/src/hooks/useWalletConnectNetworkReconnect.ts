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

import { useEffect, useRef } from 'react'
import { onlineManager } from '@tanstack/react-query'
import { reconnectAllConnectors } from '../connection'

// Trailing delay before sweeping after an offline→online edge, so a
// flapping link (captive portal, cell handover) collapses into one sweep
// once connectivity actually settles.
const NETWORK_RECONNECT_DEBOUNCE_MS = 1000

/**
 * Reconnects WalletConnect bridge sockets when network connectivity
 * returns.
 *
 * WalletConnect v1's own network-regain reconnect is dead code in React
 * Native (its NetworkMonitor binds `window` 'online' events RN never
 * emits), so without this a drop-and-regain while the app stays
 * foregrounded leaves every session socket dead until the next
 * background→foreground trip. Subscribes to `onlineManager` — fed by the
 * reachability-aware network status listener at app root — and runs the
 * same `reconnectAllConnectors` sweep the foreground hook uses on each
 * offline→online edge. Going offline again inside the debounce window
 * cancels the pending sweep. Re-entrancy is safe: concurrent sweeps
 * share per-connector recreations via `ensureConnectorReady`'s in-flight
 * map.
 *
 * Mounted once at the WalletConnect provider level, next to
 * `useWalletConnectForegroundReconnect`.
 */
export const useWalletConnectNetworkReconnect = (): void => {
    const wasOnline = useRef(onlineManager.isOnline())
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        const clearPendingSweep = () => {
            if (debounceTimer.current !== null) {
                clearTimeout(debounceTimer.current)
                debounceTimer.current = null
            }
        }

        const unsubscribe = onlineManager.subscribe(isOnline => {
            const cameOnline = !wasOnline.current && isOnline
            wasOnline.current = isOnline

            if (!isOnline) {
                // Sweeping into a dead link is pointless — wait for the
                // next online edge.
                clearPendingSweep()
                return
            }
            if (!cameOnline) return

            clearPendingSweep()
            debounceTimer.current = setTimeout(() => {
                debounceTimer.current = null
                reconnectAllConnectors()
            }, NETWORK_RECONNECT_DEBOUNCE_MS)
        })

        return () => {
            unsubscribe()
            clearPendingSweep()
        }
    }, [])
}
