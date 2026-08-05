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
import { usePushToken } from '@perawallet/wallet-core-device'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * Web twin of the native hook. Same contract — seed from bootstrap, keep the
 * store current, and let `useDevice.buildPayload` reconcile the backend — but
 * the refresh edge is the surface becoming visible rather than RN's AppState,
 * and there is no token-refresh subscription: the JS SDK has no
 * onTokenRefresh, so the service worker re-mints on pushsubscriptionchange and
 * the poll below picks the new value up.
 */
export const useTokenListener = (token: Nullable<string>): void => {
    const provider = usePeraProvider()
    const { pushToken, setPushToken } = usePushToken()

    // Read in the callback below without making it re-subscribe every time the
    // token changes.
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
        const handleVisibilityChange = () => {
            void provider.pushNotification.getPushToken().then(next => {
                // Only ever upgrade: a failed read (offline, revoked
                // permission) must not drop a token the backend still uses.
                if (next) applyToken(next)
            })
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            )
        }
    }, [provider, applyToken])
}
