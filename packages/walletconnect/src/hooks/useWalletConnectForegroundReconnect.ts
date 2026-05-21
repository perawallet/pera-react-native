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

import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { reconnectAllConnectors } from '../connection'
import { getAppStatePlatform, isForegroundTransition } from '../utils/app-state'

/**
 * Reconnects WalletConnect bridge sockets when the app returns to the
 * foreground.
 *
 * Pera RN is on WalletConnect v1, where each session owns a single bridge
 * WebSocket. The OS suspends that socket while the app is backgrounded
 * and v1 does not reliably revive it on its own, so a backgrounded
 * session silently stops both delivering signed responses and receiving
 * new dApp requests. Recreating dead sockets on every background→
 * foreground transition keeps sessions live — and keeps the
 * `ensureConnectorReady` delivery guard on its fast path — mirroring the
 * foreground reconnection Pera Android performs via its
 * `ApplicationStatusObserver`.
 *
 * Mounted once at the WalletConnect provider level.
 */
export const useWalletConnectForegroundReconnect = (): void => {
    const appState = useRef(AppState.currentState)
    const appStatePlatform = useRef(getAppStatePlatform()).current

    useEffect(() => {
        const subscription = AppState.addEventListener(
            'change',
            nextAppState => {
                const previousState = appState.current
                appState.current = nextAppState

                if (
                    isForegroundTransition(
                        previousState,
                        nextAppState,
                        appStatePlatform,
                    )
                ) {
                    reconnectAllConnectors()
                }
            },
        )

        return () => subscription.remove()
    }, [appStatePlatform])
}
