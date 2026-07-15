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

import type { InboxItem as InboxItemModel } from '@perawallet/wallet-core-messages'
import { IN_FLIGHT_SIGN_REQUEST_STATUSES } from '@perawallet/wallet-core-multisig'
import {
    formatRelativeTime,
    formatTimeRemaining,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import type { IconName } from '@components/core'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { getSignedResponseCount } from '@modules/multisig/utils'

type MultisigSignItem = Extract<InboxItemModel, { type: 'multisig_sign' }>

type UseMultisigSignInboxItemResult = {
    avatarIcon: IconName
    truncatedAddress: string
    relativeTime: string
    isWaiting: boolean
    isSuccess: boolean
    isFailure: boolean
    statusKey: string
    signedCount: number
    threshold: number
    timeRemaining: string | null
}

const STATUS_KEY_BY_STATUS: Record<
    string,
    | 'messages.inbox.multisig_sign.status_pending'
    | 'messages.inbox.multisig_sign.status_failed'
    | 'messages.inbox.multisig_sign.status_expired'
    | 'messages.inbox.multisig_sign.status_declined'
    | 'messages.inbox.multisig_sign.status_confirmed'
> = {
    pending: 'messages.inbox.multisig_sign.status_pending',
    ready: 'messages.inbox.multisig_sign.status_pending',
    submitting: 'messages.inbox.multisig_sign.status_pending',
    failed: 'messages.inbox.multisig_sign.status_failed',
    expired: 'messages.inbox.multisig_sign.status_expired',
    declined: 'messages.inbox.multisig_sign.status_declined',
    confirmed: 'messages.inbox.multisig_sign.status_confirmed',
}

export const useMultisigSignInboxItem = (
    item: MultisigSignItem,
): UseMultisigSignInboxItemResult => {
    const isDark = useIsDarkMode()

    const avatarIcon: IconName = isDark
        ? 'accounts/dark/multisig-account'
        : 'accounts/light/multisig-account'

    const { data, createdAt } = item
    const status = data.status
    const isWaiting = IN_FLIGHT_SIGN_REQUEST_STATUSES.has(status)
    const isSuccess = status === 'confirmed'
    const isFailure = !isWaiting && !isSuccess

    return {
        avatarIcon,
        truncatedAddress: truncateAlgorandAddress(data.multisigAccount.address),
        relativeTime: formatRelativeTime(createdAt),
        isWaiting,
        isSuccess,
        isFailure,
        statusKey:
            STATUS_KEY_BY_STATUS[status] ??
            'messages.inbox.multisig_sign.status_pending',
        signedCount: getSignedResponseCount(data),
        threshold: data.multisigAccount.threshold,
        timeRemaining: isWaiting
            ? formatTimeRemaining(data.expectedExpireDatetime)
            : null,
    }
}
