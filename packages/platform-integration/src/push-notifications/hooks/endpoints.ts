import { queryClient, type Network } from "@perawallet/wallet-core-shared"
import type { NotificationsListResponse, NotificationStatusResponse } from "../models"

export const getNotificationStatusEndpoint = (deviceID: string) => {
    return `/v1/devices/${deviceID}/notification-status/`
}

export const fetchNotificationStatus = async (network: Network, deviceID: string) => {
    const endpoint = getNotificationStatusEndpoint(deviceID)
    const response = await queryClient<NotificationStatusResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: endpoint,
    })

    return response.data
}

export const getNotificationListEndpoint = (deviceID: string) => {
    return `/v1/devices/${deviceID}/notifications/`
}

export const fetchNotificationList = async (network: Network, deviceID: string, cursor?: string) => {
    const endpoint = getNotificationListEndpoint(deviceID)
    const response = await queryClient<NotificationsListResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: endpoint,
        params: {
            cursor,
        }
    })

    return response.data
}