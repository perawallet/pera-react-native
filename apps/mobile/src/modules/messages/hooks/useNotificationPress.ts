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

import { useCallback } from 'react'
import type { PeraNotification } from '@perawallet/wallet-core-messages'
import { useDeepLink } from '@hooks/useDeepLink'
import {
    getMultisigIntentKind,
    isTerminalMultisigNotification,
    useHandleMultisigNotification,
} from './useHandleMultisigNotification'
import {
    trackEvent,
    NotificationsEvent,
    AnalyticsMetadataKey,
} from '@analytics'

// Re-exported so the in-app resolution helper keeps its established import path.
export { findInboxItemForNotification } from './useHandleMultisigNotification'

type UseNotificationPressResult = {
    handleNotificationPress: (notification: PeraNotification) => void
}

export const useNotificationPress = (): UseNotificationPressResult => {
    const { isValidDeepLink, handleDeepLink } = useDeepLink()
    const { handleMultisigNotification } = useHandleMultisigNotification()

    const handleNotificationPress = useCallback(
        (notification: PeraNotification) => {
            trackEvent(NotificationsEvent.Open, {
                [AnalyticsMetadataKey.NotificationUrl]:
                    notification.url ?? undefined,
            })
            const intentKind = getMultisigIntentKind(notification.type)
            if (intentKind) {
                handleMultisigNotification(
                    intentKind,
                    notification.accountAddress,
                )
                return
            }
            if (isTerminalMultisigNotification(notification.type)) {
                return
            }
            if (notification.url && isValidDeepLink(notification.url)) {
                void handleDeepLink(notification.url, true, 'notification')
            }
        },
        [isValidDeepLink, handleDeepLink, handleMultisigNotification],
    )

    return { handleNotificationPress }
}
