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

import { useEffect, useMemo, useRef } from 'react'
import {
    type PeraNotification,
    useInboxStatus,
    useNotificationsListQuery,
    useMarkNotificationsAsReadMutation,
} from '@perawallet/wallet-core-messages'
import { useNotificationPress } from '@modules/messages/hooks'

export type UseNotificationsScreenResult = {
    isPending: boolean
    notifications: PeraNotification[]
    isFetchingNextPage: boolean
    isRefetching: boolean
    keyExtractor: (item: PeraNotification) => string
    loadMoreItems: () => Promise<void>
    refetch: () => void
    handleNotificationPress: (notification: PeraNotification) => void
}

export const useNotificationsScreen = (): UseNotificationsScreenResult => {
    const { hasUnreadNotifications } = useInboxStatus()
    const {
        data,
        isPending,
        fetchNextPage,
        isFetchingNextPage,
        isRefetching,
        refetch,
    } = useNotificationsListQuery()
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

    const loadMoreItems = async () => {
        await fetchNextPage()
    }

    return {
        isPending,
        notifications,
        isFetchingNextPage,
        isRefetching,
        keyExtractor: (item: PeraNotification) => item.id,
        loadMoreItems,
        refetch: () => void refetch(),
        handleNotificationPress,
    }
}
