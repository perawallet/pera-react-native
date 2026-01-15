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

import { useEffect } from 'react'
import { useFcmToken } from '@perawallet/wallet-core-platform-integration'

/**
 * Hook that initializes the FCM token after bootstrap.
 * Call this once in App.tsx after bootstrapping is complete.
 *
 * This replaces the TokenProvider component, since the only purpose
 * of that provider was to call setFcmToken() with the token from bootstrap.
 *
 * @param token - The FCM token from the bootstrap process
 *
 * @example
 * // In App.tsx after bootstrap
 * useTokenListener(fcmToken)
 */
export const useTokenListener = (token: string | null): void => {
    const { setFcmToken } = useFcmToken()

    useEffect(() => {
        setFcmToken(token)
    }, [token, setFcmToken])
}
