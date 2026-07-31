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
import { AppState, type AppStateStatus } from 'react-native'
import { usePushToken } from '@perawallet/wallet-core-device'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * Owns the push token's lifecycle: seeds the store with the token resolved at
 * bootstrap, then keeps it current for the rest of the session.
 *
 * Cold start alone is not enough. `initializeNotifications` only resolves a
 * token when permission was *already* granted, and the platform can reissue a
 * token at any time — so without the two subscriptions below, a user who grants
 * permission after launch gets no pushes until the next relaunch, and a rotated
 * token leaves the backend pushing to a dead one.
 *
 * Writing the store is all it takes to reconcile the backend:
 * `useDevice.buildPayload` reads `pushToken`, so a change re-runs device
 * registration with the new token.
 *
 * Call this once in App.tsx after bootstrapping is complete.
 *
 * @param token - The FCM token from the bootstrap process
 *
 * @example
 * // In App.tsx after bootstrap
 * useTokenListener(fcmToken)
 */
export const useTokenListener = (token: Nullable<string>): void => {
    const provider = usePeraProvider()
    const { pushToken, setPushToken } = usePushToken()

    // Read in the callbacks below without making them re-subscribe every time
    // the token changes.
    const pushTokenRef = useRef(pushToken)
    pushTokenRef.current = pushToken

    const applyToken = useCallback(
        (next: string) => {
            if (next === pushTokenRef.current) return
            setPushToken(next)
        },
        [setPushToken],
    )

    useEffect(() => {
        setPushToken(token)
    }, [token, setPushToken])

    useEffect(() => {
        return provider.pushNotification.addTokenRefreshListener(applyToken)
    }, [provider, applyToken])

    // Notification permission is granted in OS settings, outside the app, so
    // the resume edge is the only signal that it may have changed — and a
    // denied cold start leaves no token at all, which is the case this covers.
    useEffect(() => {
        const handleAppStateChange = (nextState: AppStateStatus) => {
            if (nextState !== 'active') return
            void provider.pushNotification.getPushToken().then(next => {
                // Only ever upgrade: a failed read (offline, revoked
                // permission) must not drop a token the backend still uses.
                if (next) applyToken(next)
            })
        }

        const subscription = AppState.addEventListener(
            'change',
            handleAppStateChange,
        )

        return () => subscription.remove()
    }, [provider, applyToken])
}
