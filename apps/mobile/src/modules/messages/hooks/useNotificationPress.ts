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
    useInboxQuery,
    type InboxItem,
    type PeraNotification,
} from '@perawallet/wallet-core-messages'
import { useDeepLink } from '@hooks/useDeepLink'
import { navigateToScreen } from '@hooks/deeplink/navigateToScreen'
import { useHandleInboxItemPress } from './useHandleInboxItemPress'

type MultisigIntentKind = 'sign' | 'import'

type UseNotificationPressResult = {
    handleNotificationPress: (notification: PeraNotification) => void
}

const getMultisigIntentKind = (
    type: PeraNotification['type'],
): MultisigIntentKind | null => {
    if (type === MULTISIG_NEW_SIGN_REQUEST_NOTIFICATION_TYPE) return 'sign'
    if (type === MULTISIG_IMPORT_ACCOUNT_NOTIFICATION_TYPE) return 'import'
    return null
}

// A multisig notification only carries an account address, so resolve it to
// the matching inbox item before reusing the inbox press handler. Only act on
// an unambiguous single match — multiple sign requests for the same shared
// account can't be auto-targeted, so the user simply lands on the inbox.
export const findInboxItemForNotification = (
    items: InboxItem[],
    kind: MultisigIntentKind,
    address: string,
): InboxItem | undefined => {
    const matches = items.filter(item => {
        if (kind === 'sign' && item.type === 'multisig_sign') {
            return item.data.multisigAccount.address === address
        }
        if (kind === 'import' && item.type === 'multisig_import') {
            return item.data.address === address
        }
        return false
    })
    return matches.length === 1 ? matches[0] : undefined
}

export const useNotificationPress = (): UseNotificationPressResult => {
    const { isValidDeepLink, handleDeepLink } = useDeepLink()
    const { refetch: refetchInbox } = useInboxQuery()
    const handleInboxItemPress = useHandleInboxItemPress()

    const handleNotificationPress = useCallback(
        (notification: PeraNotification) => {
            const intentKind = getMultisigIntentKind(notification.type)
            if (intentKind) {
                // Switch to the Inbox tab first so the user lands there while
                // we fetch. Nested-navigator targeting (`params.screen`) is
                // required because the `initialTab` route param is only read by
                // useMessagesScreen's useState on MessagesHome's first mount.
                navigateToScreen(false, 'Messages', {
                    screen: 'MessagesHome',
                    params: { screen: 'Inbox' },
                })
                // Refetch so a sign request / invitation that landed between the
                // last poll and this tap is present, then hand the matching item
                // to the same handler the inbox list uses on tap.
                void refetchInbox()
                    .then(({ data }) => {
                        const match = findInboxItemForNotification(
                            data ?? [],
                            intentKind,
                            notification.accountAddress,
                        )
                        if (match) handleInboxItemPress(match)
                    })
                    .catch(() => {
                        // Best-effort: if the resolution fetch fails the user is
                        // already on the inbox, where the list's own query will
                        // surface the item once it settles.
                    })
                return
            }
            // Declined/expired notifications carry an `account-detail` URL for a
            // shared account that often isn't local, which silently bounces the
            // user to Home. There is no actionable target for terminal sign
            // requests, so suppress navigation entirely.
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
        [isValidDeepLink, handleDeepLink, refetchInbox, handleInboxItemPress],
    )

    return { handleNotificationPress }
}
