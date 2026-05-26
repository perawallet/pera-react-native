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

import { useCallback } from 'react'
import {
    MULTISIG_DECLINED_NOTIFICATION_TYPE,
    MULTISIG_EXPIRED_NOTIFICATION_TYPE,
    MULTISIG_IMPORT_ACCOUNT_NOTIFICATION_TYPE,
    MULTISIG_NEW_SIGN_REQUEST_NOTIFICATION_TYPE,
    useInboxInvalidator,
    type PeraNotification,
} from '@perawallet/wallet-core-messages'
import { useDeepLink } from '@hooks/useDeepLink'
import { navigateToScreen } from '@hooks/deeplink/navigateToScreen'
import { useMultisigNotificationIntentStore } from '@modules/multisig/stores/useMultisigNotificationIntentStore'

type UseNotificationPressResult = {
    handleNotificationPress: (notification: PeraNotification) => void
}

export const useNotificationPress = (): UseNotificationPressResult => {
    const { isValidDeepLink, handleDeepLink } = useDeepLink()
    const setIntent = useMultisigNotificationIntentStore(
        state => state.setIntent,
    )
    const { invalidate: invalidateInbox } = useInboxInvalidator()

    const handleNotificationPress = useCallback(
        (notification: PeraNotification) => {
            if (
                notification.type ===
                    MULTISIG_NEW_SIGN_REQUEST_NOTIFICATION_TYPE ||
                notification.type === MULTISIG_IMPORT_ACCOUNT_NOTIFICATION_TYPE
            ) {
                setIntent({
                    kind:
                        notification.type ===
                        MULTISIG_NEW_SIGN_REQUEST_NOTIFICATION_TYPE
                            ? 'sign'
                            : 'import',
                    address: notification.accountAddress,
                })
                // Refetch the inbox so the auto-press effect in
                // useInboxScreen sees the freshly-arrived sign request
                // or invitation. Without this, the cache may still be
                // empty for items that landed between the last poll and
                // the user's tap.
                invalidateInbox()
                // Use nested-navigator targeting (`params.screen`) so the
                // material top Tab.Navigator actually switches to Inbox.
                // The `initialTab` route param is only consumed by
                // useMessagesScreen's useState on first mount, so passing
                // it does not change the tab when MessagesHome is already
                // mounted (e.g. user is on the Notifications tab).
                navigateToScreen(false, 'Messages', {
                    screen: 'MessagesHome',
                    params: { screen: 'Inbox' },
                })
                return
            }
            // Declined/expired notifications carry an `account-detail` URL
            // for a multisig account that often isn't local, which silently
            // bounces the user to Home. There is no actionable target for
            // terminal sign requests, so suppress navigation entirely.
            if (
                notification.type === MULTISIG_DECLINED_NOTIFICATION_TYPE ||
                notification.type === MULTISIG_EXPIRED_NOTIFICATION_TYPE
            ) {
                return
            }
            if (notification.url && isValidDeepLink(notification.url)) {
                handleDeepLink(notification.url, true, 'deeplink')
            }
        },
        [isValidDeepLink, handleDeepLink, setIntent, invalidateInbox],
    )

    return { handleNotificationPress }
}
