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

import { useEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import {
    type PeraNotification,
    useNotificationsListQuery,
    useMarkNotificationsAsReadMutation,
} from '@perawallet/wallet-core-notifications'

export type UseNotificationsScreenResult = {
    isPending: boolean
    notifications: PeraNotification[]
    isFetchingNextPage: boolean
    isRefetching: boolean
    keyExtractor: (item: PeraNotification) => string
    loadMoreItems: () => Promise<void>
    refetch: () => void
}

export const useNotificationsScreen = (): UseNotificationsScreenResult => {
    const navigation = useNavigation()
    const {
        data,
        isPending,
        fetchNextPage,
        isFetchingNextPage,
        isRefetching,
        refetch,
    } = useNotificationsListQuery()
    const { markAsRead } = useMarkNotificationsAsReadMutation()

    const notifications = data ?? []

    useEffect(() => {
        const unsubscribe = navigation.addListener('blur', () => {
            const hasUnread = notifications.some(n => n.isUnread)

            if (notifications.length > 0 && hasUnread) {
                markAsRead(parseInt(notifications[0].id, 10))
            }
        })

        return unsubscribe
    }, [navigation, notifications, markAsRead])

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
        refetch,
    }
}
