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
import type { Maybe } from '@perawallet/wallet-core-shared'
import {
    MULTISIG_IMPORT_ACCOUNT_NOTIFICATION_TYPE,
    MULTISIG_NEW_SIGN_REQUEST_NOTIFICATION_TYPE,
    useInboxQuery,
    type InboxItem,
} from '@perawallet/wallet-core-messages'
import { navigateToScreen } from '@hooks/deeplink/navigateToScreen'
import { useHandleInboxItemPress } from './useHandleInboxItemPress'

export type MultisigIntentKind = 'sign' | 'import'

type UseHandleMultisigNotificationResult = {
    handleMultisigNotification: (
        kind: MultisigIntentKind,
        accountAddress: Maybe<string>,
    ) => void
}

export const getMultisigIntentKind = (
    type: Maybe<string>,
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
    address: Maybe<string>,
): InboxItem | undefined => {
    if (!address) return undefined
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

/**
 * Shared routing for a multisig sign/import notification, used by both the
 * in-app Notifications list and OS push taps. A multisig push carries no
 * sign-request deeplink — only the shared-account address — so both entry
 * points must resolve it the same way: switch to the Inbox tab, refetch, then
 * hand the single matching inbox item to the same press handler the list uses.
 * Kept in one place so the two paths can't drift.
 */
export const useHandleMultisigNotification =
    (): UseHandleMultisigNotificationResult => {
        const { refetch: refetchInbox } = useInboxQuery()
        const handleInboxItemPress = useHandleInboxItemPress()

        const handleMultisigNotification = useCallback(
            (kind: MultisigIntentKind, accountAddress: Maybe<string>) => {
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
                            kind,
                            accountAddress,
                        )
                        if (match) handleInboxItemPress(match)
                    })
                    .catch(() => {
                        // Best-effort: if the resolution fetch fails the user is
                        // already on the inbox, where the list's own query will
                        // surface the item once it settles.
                    })
            },
            [refetchInbox, handleInboxItemPress],
        )

        return { handleMultisigNotification }
    }
