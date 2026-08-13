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
import { useQuery } from '@tanstack/react-query'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { config } from '@perawallet/wallet-core-config'
import {
    fetchMessageStatus,
    fetchNotificationStatus,
    type NotificationStatusResponse,
} from '../api/notifications'
import {
    getMessageStatusQueryKey,
    getNotificationStatusQueryKey,
} from './querykeys'
import { useInboxQuery } from './useInboxQuery'

type UseInboxStatusResult = {
    hasUnreadItems: boolean
    hasUnreadInboxItems: boolean
    hasUnreadNotifications: boolean
    unreadInboxCount: number
}

// While v3 is failing the v1 fallback owns freshness; v3 keeps probing for
// recovery at this multiple of the normal cadence instead of double-polling
// both endpoints at full rate.
const ERROR_PROBE_INTERVAL_MULTIPLIER = 10

export const useInboxStatus = (): UseInboxStatusResult => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)

    // Primary source of truth: the unified v3 message-status endpoint returns
    // both the unread flags and the inbox count in a single call.
    const messageStatus = useQuery({
        queryKey: getMessageStatusQueryKey(network, deviceID ?? ''),
        queryFn: () => fetchMessageStatus(network, deviceID ?? ''),
        enabled: !!deviceID,
        // Overrides the globally-pinned false: the badge should catch up as
        // soon as the app foregrounds — pushes that arrived while
        // backgrounded (intervals are paused then) and restart-hydrated
        // state otherwise stay stale for up to a full poll interval.
        refetchOnWindowFocus: true,
        refetchInterval: query => {
            if (!config.pollingEnabled) return false
            const isFailing =
                query.state.data === undefined &&
                query.state.status === 'error'
            return isFailing
                ? config.notificationRefreshTime *
                      ERROR_PROBE_INTERVAL_MULTIPLIER
                : config.notificationRefreshTime
        },
    })

    // Only fall back when v3 has produced no usable data at all (errored and
    // never succeeded). If an earlier poll succeeded, TanStack keeps the last
    // good data, so we keep using it instead of flapping to the legacy path.
    const hasMessageStatus = messageStatus.data !== undefined
    const shouldUseFallback = !hasMessageStatus && messageStatus.isError

    // Fallback source of truth: the legacy v1 notification-status endpoint plus
    // the inbox list. Fired only when the v3 endpoint is unavailable, so a
    // backend problem degrades gracefully rather than hiding the badge.
    const { data: notificationStatusData } = useQuery({
        queryKey: getNotificationStatusQueryKey(network, deviceID ?? ''),
        queryFn: () => fetchNotificationStatus(network, deviceID ?? ''),
        enabled: !!deviceID && shouldUseFallback,
        refetchInterval: config.pollingEnabled
            ? config.notificationRefreshTime
            : false,
        select: useCallback(
            (data: NotificationStatusResponse) => data.has_new_notification,
            [],
        ),
    })

    const { data: inboxData } = useInboxQuery()

    if (hasMessageStatus) {
        return {
            hasUnreadItems: messageStatus.data.hasUnreadItems,
            hasUnreadInboxItems: messageStatus.data.hasUnreadInboxItems,
            hasUnreadNotifications: messageStatus.data.hasUnreadNotifications,
            unreadInboxCount: messageStatus.data.unreadInboxCount,
        }
    }

    const unreadInboxCount = inboxData?.length ?? 0
    const hasUnreadInboxItems = unreadInboxCount > 0
    const hasUnreadNotifications = notificationStatusData ?? false

    return {
        hasUnreadItems: hasUnreadInboxItems || hasUnreadNotifications,
        hasUnreadInboxItems,
        hasUnreadNotifications,
        unreadInboxCount,
    }
}
