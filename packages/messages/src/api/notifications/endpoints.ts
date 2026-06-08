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

import { queryClient, type Network } from '@perawallet/wallet-core-shared'
import {
    notificationStatusResponseSchema,
    notificationsListResponseSchema,
    type NotificationStatusResponse,
    type NotificationsListResponse,
    messageStatusResponseSchema,
    type MessageStatusResponse,
} from './schema'

const getNotificationStatusEndpoint = (deviceID: string) =>
    `/v1/devices/${deviceID}/notification-status/`

const getNotificationListEndpoint = (deviceID: string) =>
    `/v2/devices/${deviceID}/notifications/`

const getUpdateNotificationEnabledEndpoint = (
    deviceID: string,
    accountID: string,
) => `/v1/devices/${deviceID}/accounts/${accountID}/`

export const fetchNotificationStatus = async (
    network: Network,
    deviceID: string,
): Promise<NotificationStatusResponse> => {
    const response = await queryClient<NotificationStatusResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: getNotificationStatusEndpoint(deviceID),
    })

    return notificationStatusResponseSchema.parse(response.data)
}

export const fetchNotificationList = async (
    network: Network,
    deviceID: string,
    cursor?: string,
): Promise<NotificationsListResponse> => {
    const response = await queryClient<NotificationsListResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: getNotificationListEndpoint(deviceID),
        params: { cursor },
    })

    return notificationsListResponseSchema.parse(response.data)
}

export const updateLastSeenNotification = async (
    network: Network,
    deviceID: string,
    lastSeenNotificationId: number,
): Promise<void> => {
    await queryClient({
        backend: 'pera',
        network,
        method: 'PUT',
        url: `/v1/devices/${deviceID}/update-last-seen-notification/`,
        data: { last_seen_notification_id: lastSeenNotificationId },
    })
}

export const updateNotificationEnabled = async (
    network: Network,
    deviceID: string,
    accountID: string,
    status: boolean,
): Promise<NotificationStatusResponse> => {
    const response = await queryClient<NotificationStatusResponse>({
        backend: 'pera',
        network,
        method: 'PATCH',
        url: getUpdateNotificationEnabledEndpoint(deviceID, accountID),
        data: { receive_notifications: status },
    })

    return notificationStatusResponseSchema.parse(response.data)
}

export const fetchMessageStatus = async (
    network: Network,
    deviceID: string,
): Promise<MessageStatusResponse> => {
    const response = await queryClient<MessageStatusResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: `/api/v3/devices/${deviceID}/message-status`,
    })

    return messageStatusResponseSchema.parse(response.data)
}
