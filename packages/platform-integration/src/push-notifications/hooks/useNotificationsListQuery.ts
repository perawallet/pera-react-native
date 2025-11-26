
import type { Network } from '@perawallet/wallet-core-shared'
import { useCallback } from 'react'
import { useDeviceID, useNetwork } from '../../device'
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'
import { fetchNotificationList } from './endpoints'
import type { NotificationResponse, NotificationsListResponse, PeraNotification } from '../models'

export const getNotificationsListQueryKey = (network: Network, deviceID: string) => {
    return ['v1', 'devices', deviceID, 'notifications', network]
}

const mapNotificationResponseToNotification = (response: NotificationResponse): PeraNotification => {
    return {
        id: response.id,
        title: response.title,
        message: response.message,
        createdAt: new Date(response.creation_datetime),
        metadata: response.metadata ? response.metadata as Record<string, unknown> : {},
    }
}

export const useNotificationsList = () => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)

    return useInfiniteQuery({
        queryKey: getNotificationsListQueryKey(network, deviceID!),
        queryFn: ({ pageParam }) => fetchNotificationList(network, deviceID!, pageParam as string | undefined),
        initialPageParam: '',
        getNextPageParam: (lastPage) => {
            return lastPage.next
        },
        getPreviousPageParam: (firstPage) => {
            return firstPage.previous
        },
        enabled: !!deviceID,
        select: useCallback((data: InfiniteData<NotificationsListResponse>) => {
            return data.pages.flatMap((p: NotificationsListResponse) => p.results.map((r: NotificationResponse) => mapNotificationResponseToNotification(r)))
        }, [])
    })
}
