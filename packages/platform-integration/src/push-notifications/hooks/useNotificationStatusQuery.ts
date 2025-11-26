
import { useQuery } from '@tanstack/react-query'
import { useDeviceID, useNetwork } from '../../device'
import { fetchNotificationStatus } from './endpoints'
import type { Network } from '@perawallet/wallet-core-shared'
import { config } from '@perawallet/wallet-core-config'
import { useCallback } from 'react'
import type { NotificationStatusResponse } from '../models'

export const getNotificationStatusQueryKey = (network: Network, deviceID: string) => {
    return ['v1', 'devices', deviceID, 'notification-status', network]
}

export const useNotificationStatus = () => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    return useQuery({
        queryKey: getNotificationStatusQueryKey(network, deviceID ?? ''),
        queryFn: () => fetchNotificationStatus(network, deviceID ?? ''),
        enabled: !!deviceID,
        staleTime: config.notificationRefreshTime,
        select: useCallback((data: NotificationStatusResponse) => {
            return {
                hasNewNotification: data.has_new_notification,
            }
        }, [])
    })
}
