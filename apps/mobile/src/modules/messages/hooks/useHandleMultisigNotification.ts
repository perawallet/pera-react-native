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
    MULTISIG_DECLINED_NOTIFICATION_TYPE,
    MULTISIG_EXPIRED_NOTIFICATION_TYPE,
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

/**
 * A declined/expired sign request has no actionable target: it carries an
 * `account-detail` URL for a shared account that often isn't local, so routing
 * it silently bounces the user to Home. Both the in-app list and OS push taps
 * suppress navigation for these, and share this predicate so they can't drift.
 */
export const isTerminalMultisigNotification = (type: Maybe<string>): boolean =>
    type === MULTISIG_DECLINED_NOTIFICATION_TYPE ||
    type === MULTISIG_EXPIRED_NOTIFICATION_TYPE

const inboxItemTypeFor = (kind: MultisigIntentKind): InboxItem['type'] =>
    kind === 'sign' ? 'multisig_sign' : 'multisig_import'

// A multisig notification resolves to an inbox item before reusing the inbox
// press handler. Only act on an unambiguous single match — multiple sign
// requests for the same shared account can't be auto-targeted, so the user
// simply lands on the inbox.
//
// A push carries no address at all (only /v1/notifications does), so with none
// supplied the kind alone has to do the targeting. That is safe under the same
// single-match rule: one pending item of that kind is unambiguous regardless of
// which account it belongs to.
export const findInboxItemForNotification = (
    items: InboxItem[],
    kind: MultisigIntentKind,
    address: Maybe<string>,
): InboxItem | undefined => {
    const ofKind = items.filter(item => item.type === inboxItemTypeFor(kind))
    if (!address) {
        return ofKind.length === 1 ? ofKind[0] : undefined
    }
    const matches = ofKind.filter(item => {
        if (item.type === 'multisig_sign') {
            return item.data.multisigAccount.address === address
        }
        if (item.type === 'multisig_import') {
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
                // to the same handler the inbox list uses on tap. refetch()
                // resolves to the refreshed items directly, not a query result.
                void refetchInbox()
                    .then(items => {
                        const match = findInboxItemForNotification(
                            items,
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
