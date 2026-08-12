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

import { useEffect } from 'react'

import { logger } from '@perawallet/wallet-core-shared'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'
import {
    getMultisigIntentKind,
    useHandleMultisigNotification,
} from '@modules/messages/hooks'

import { useDeepLink } from './useDeepLink'

/**
 * Bridges OS push-notification taps to the app's routing (foreground,
 * background-resume, or cold-start).
 *
 * A multisig sign/import push carries no sign-request deeplink — only the
 * shared-account address — so it's routed by notification type through the same
 * resolver the in-app Notifications list uses. Every other tap keeps the
 * URL-based routing: it's validated and handed to `handleDeepLink`, reaching
 * the same dispatcher as a scanned QR or an external deeplink.
 *
 * Mount once at the root: the platform service holds a single listener slot,
 * so registering from multiple places would clobber it (and re-fire taps).
 */
export const useNotificationDeeplinkListener = () => {
    const provider = usePeraProvider()
    const { handleDeepLink, isValidDeepLink } = useDeepLink()
    const { handleMultisigNotification } = useHandleMultisigNotification()

    useEffect(() => {
        const unsubscribe =
            provider.pushNotification.addNotificationOpenListener(payload => {
                logger.debug('Notification: tapped', { payload })
                const intentKind = getMultisigIntentKind(payload.type)
                if (intentKind) {
                    handleMultisigNotification(
                        intentKind,
                        payload.accountAddress,
                    )
                    return
                }
                if (payload.url && isValidDeepLink(payload.url)) {
                    void handleDeepLink(payload.url, false, 'notification')
                }
            })

        return unsubscribe
    }, [provider, handleDeepLink, isValidDeepLink, handleMultisigNotification])
}
