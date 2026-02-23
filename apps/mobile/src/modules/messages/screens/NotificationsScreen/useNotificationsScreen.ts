import { useLanguage } from '@hooks/useLanguage'
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
