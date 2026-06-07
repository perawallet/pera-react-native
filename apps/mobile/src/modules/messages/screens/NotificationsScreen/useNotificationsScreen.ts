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

import { useEffect, useMemo } from 'react'
import { useNavigation } from '@react-navigation/native'
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
    const navigation = useNavigation()
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

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            if (notifications.length > 0 && hasUnreadNotifications) {
                markAsRead(parseInt(notifications[0].id, 10))
            }
        })

        return unsubscribe
    }, [navigation, notifications, markAsRead, hasUnreadNotifications])

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
