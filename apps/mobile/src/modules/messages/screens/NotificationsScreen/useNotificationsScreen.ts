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

import {
    PeraNotification,
    useNotificationsListQuery,
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
    const {
        data,
        isPending,
        fetchNextPage,
        isFetchingNextPage,
        isRefetching,
        refetch,
    } = useNotificationsListQuery()

    const loadMoreItems = async () => {
        await fetchNextPage()
    }

    return {
        isPending,
        notifications: data ?? [],
        isFetchingNextPage,
        isRefetching,
        keyExtractor: (item: PeraNotification) => item.id,
        loadMoreItems,
        refetch,
    }
}
