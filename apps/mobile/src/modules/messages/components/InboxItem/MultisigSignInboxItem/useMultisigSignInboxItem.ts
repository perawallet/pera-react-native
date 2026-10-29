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

import { useEffect, useState } from 'react'
import {
    LEGACY_CHAIN_ID,
    i18nKey,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import type { InboxItem as InboxItemModel } from '@perawallet/wallet-core-messages'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { deploymentOf } from '@perawallet/wallet-core-config'
import { useDeploymentDeviceID } from '@perawallet/wallet-core-device'
import {
    IN_FLIGHT_SIGN_REQUEST_STATUSES,
    useSignRequestDetailQuery,
} from '@perawallet/wallet-core-multisig'
import {
    formatRelativeTime,
    formatTimeRemaining,
    truncateAlgorandAddress,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { IconName } from '@components/core'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { getSignedResponseCount } from '@modules/multisig'

type MultisigSignItem = Extract<InboxItemModel, { type: 'multisig_sign' }>

type UseMultisigSignInboxItemResult = {
    avatarIcon: IconName
    truncatedAddress: string
    relativeTime: string
    isWaiting: boolean
    isSuccess: boolean
    isFailure: boolean
    statusKey: I18nKey
    signedCount: number
    threshold: number
    timeRemaining: Nullable<string>
}

/**
 * How long a `failed` async request is held as "still submitting" before the
 * inbox commits to the failure. An async (in-app) multisig broadcast can be
 * briefly reported `failed` by the backend for a transaction that actually
 * confirmed on chain; we keep re-polling within this window so a later
 * `confirmed` supersedes it. Mirrors the pending-signatures sheet
 * (`FAILED_RECOVERY_WINDOW_MS` there) — without it the inbox shows a permanent
 * red "Failed transaction" for a successful send, because the shared inbox-list
 * query stops polling the moment a request reaches any terminal status.
 */
const FAILED_RECOVERY_WINDOW_MS = 30_000

const STATUS_KEY_BY_STATUS: Record<string, I18nKey> = {
    pending: i18nKey('messages.inbox.multisig_sign.status_pending'),
    ready: i18nKey('messages.inbox.multisig_sign.status_pending'),
    submitting: i18nKey('messages.inbox.multisig_sign.status_pending'),
    failed: i18nKey('messages.inbox.multisig_sign.status_failed'),
    expired: i18nKey('messages.inbox.multisig_sign.status_expired'),
    declined: i18nKey('messages.inbox.multisig_sign.status_declined'),
    confirmed: i18nKey('messages.inbox.multisig_sign.status_confirmed'),
}

export const useMultisigSignInboxItem = (
    item: MultisigSignItem,
): UseMultisigSignInboxItemResult => {
    const isDark = useIsDarkMode()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const deviceId = useDeploymentDeviceID(deploymentOf(scope)) ?? ''

    const avatarIcon: IconName = isDark
        ? 'accounts/dark/multisig-account'
        : 'accounts/light/multisig-account'

    const { data, createdAt } = item
    const listStatus = data.status

    // Measured from the first `failed`; reset whenever the item is no longer
    // failed. The `data.id` dep restarts the timer if the row is recycled for a
    // different request.
    const [isFailedRecoveryExpired, setIsFailedRecoveryExpired] =
        useState(false)
    useEffect(() => {
        if (listStatus !== 'failed') {
            setIsFailedRecoveryExpired(false)
            return
        }
        const timer = setTimeout(
            () => setIsFailedRecoveryExpired(true),
            FAILED_RECOVERY_WINDOW_MS,
        )
        return () => clearTimeout(timer)
    }, [listStatus, data.id])

    // The inbox-list query goes quiet once a request is terminal, so it never
    // sees the backend correct a false-negative `failed` back to `confirmed`.
    // Re-poll the detail endpoint per item, but only while recovering, so a
    // genuinely failed request isn't polled forever.
    const isRecovering = listStatus === 'failed' && !isFailedRecoveryExpired
    const { data: recovered } = useSignRequestDetailQuery({
        scope,
        deviceId,
        signRequestId: data.id,
        enabled: isRecovering,
        pollWhilePending: true,
        pollWhileFailed: isRecovering,
    })

    // A detail-poll `confirmed` supersedes the stale list `failed`.
    const status = recovered?.status ?? listStatus
    const source = recovered ?? data

    const isWithinFailureRecovery =
        status === 'failed' && !isFailedRecoveryExpired
    const isWaiting =
        IN_FLIGHT_SIGN_REQUEST_STATUSES.has(status) || isWithinFailureRecovery
    const isSuccess = status === 'confirmed'
    const isFailure = !isWaiting && !isSuccess

    return {
        avatarIcon,
        truncatedAddress: truncateAlgorandAddress(data.multisigAccount.address),
        relativeTime: formatRelativeTime(createdAt),
        isWaiting,
        isSuccess,
        isFailure,
        statusKey: isWithinFailureRecovery
            ? STATUS_KEY_BY_STATUS.submitting
            : (STATUS_KEY_BY_STATUS[status] ??
              i18nKey('messages.inbox.multisig_sign.status_pending')),
        signedCount: getSignedResponseCount(source),
        threshold: source.multisigAccount.threshold,
        timeRemaining: isWaiting
            ? formatTimeRemaining(source.expectedExpireDatetime)
            : null,
    }
}
