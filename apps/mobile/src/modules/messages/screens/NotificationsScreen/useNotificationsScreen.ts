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

import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
    type PeraNotification,
    useInboxStatus,
    useNotificationsListQuery,
    useMarkNotificationsAsReadMutation,
} from '@perawallet/wallet-core-messages'
import type { PWFlatListRef } from '@components/core'
import { useNotificationPress } from '@modules/messages/hooks'
import { useNetworkStatus } from '@modules/network'

export type UseNotificationsScreenResult = {
    isPending: boolean
    notifications: PeraNotification[]
    isFetchingNextPage: boolean
    isRefetching: boolean
    isError: boolean
    isOffline: boolean
    keyExtractor: (item: PeraNotification) => string
    loadMoreItems: () => Promise<void>
    refetch: () => void
    handleNotificationPress: (notification: PeraNotification) => void
    listRef: RefObject<PWFlatListRef | null>
    isUnavailableOnNetwork: boolean
    isDeviceUnregistered: boolean
}

export const useNotificationsScreen = (): UseNotificationsScreenResult => {
    const { hasUnreadNotifications } = useInboxStatus()
    const {
        data,
        isPending,
        isPaused,
        isError,
        fetchNextPage,
        isFetchingNextPage,
        isRefetching,
        refetch,
        isUnavailableOnNetwork,
        isDeviceUnregistered,
    } = useNotificationsListQuery()
    const { hasInternet } = useNetworkStatus()

    // Offline wins over a stale error: a paused, uncached fetch means there is
    // nothing to show yet, and an error surfacing while genuinely offline is
    // the same "nothing to show" situation — not a dead Retry. Mirrors the
    // charts / staking contract (docs/OFFLINE_PAUSED_STATE.md).
    const isOffline = isPaused || (isError && !hasInternet)
    const { markAsRead } = useMarkNotificationsAsReadMutation()
    const { handleNotificationPress } = useNotificationPress()

    const notifications = useMemo(() => data ?? [], [data])

    // Mark notifications as read only when leaving the screen (unmount), so the
    // per-item unread dots stay visible the whole time the user is viewing the
    // list instead of clearing the instant the screen gains focus. The cleanup
    // runs once on unmount, so we read the latest values from a ref rather than
    // closing over a stale first-render snapshot.
    const latestRef = useRef({ notifications, hasUnreadNotifications })
    latestRef.current = { notifications, hasUnreadNotifications }

    useEffect(() => {
        return () => {
            const { notifications, hasUnreadNotifications } = latestRef.current
            if (notifications.length > 0 && hasUnreadNotifications) {
                markAsRead(parseInt(notifications[0].id, 10))
            }
        }
    }, [markAsRead])

    const listRef = useRef<PWFlatListRef>(null)

    // On open/refocus: pull the latest notifications so freshly-created ones
    // (e.g. after a rekey) show up without a manual refresh — the tab stays
    // mounted, so it would otherwise serve stale cache — then snap to the top
    // (it would also otherwise retain its previous scroll position). Newer
    // items arriving from the refetch are revealed natively via the list's
    // maintainVisibleContentPosition autoscrollToTopThreshold.
    useFocusEffect(
        useCallback(() => {
            void refetch()
            listRef.current?.scrollToOffset({ offset: 0, animated: false })
        }, [refetch]),
    )

    const loadMoreItems = async () => {
        await fetchNextPage()
    }

    return {
        isPending,
        notifications,
        isFetchingNextPage,
        isRefetching,
        isError,
        isOffline,
        keyExtractor: (item: PeraNotification) => item.id,
        loadMoreItems,
        refetch: () => void refetch(),
        handleNotificationPress,
        listRef,
        isUnavailableOnNetwork,
        isDeviceUnregistered,
    }
}
