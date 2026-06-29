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

import { logger } from '@perawallet/wallet-core-shared'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'

import { useDeepLink } from './useDeepLink'

/**
 * Bridges OS push-notification taps to the deeplink dispatcher. The platform
 * service surfaces the tapped notification's deeplink URL (foreground,
 * background-resume, or cold-start) and this hook validates it and hands it to
 * `handleDeepLink`, so a notification reaches the same routing as a scanned QR
 * or an external deeplink.
 *
 * Mount once at the root: the platform service holds a single listener slot,
 * so registering from multiple places would clobber it (and re-fire taps).
 */
export const useNotificationDeeplinkListener = () => {
    const provider = usePeraProvider()
    const { handleDeepLink, isValidDeepLink } = useDeepLink()

    useEffect(() => {
        const unsubscribe =
            provider.pushNotification.addNotificationOpenListener(url => {
                logger.debug('Notification: deeplink tapped', { url })
                if (isValidDeepLink(url)) {
                    void handleDeepLink(url, false, 'deeplink')
                }
            })

        return unsubscribe
    }, [provider, handleDeepLink, isValidDeepLink])
}
