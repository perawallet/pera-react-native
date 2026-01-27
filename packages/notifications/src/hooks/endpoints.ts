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
import type {
    NotificationsListResponse,
    NotificationStatusResponse,
} from '../models'

export const getNotificationStatusEndpoint = (deviceID: string) => {
    return `/v1/devices/${deviceID}/notification-status/`
}

export const fetchNotificationStatus = async (
    network: Network,
    deviceID: string,
) => {
    const endpoint = getNotificationStatusEndpoint(deviceID)
    const response = await queryClient<NotificationStatusResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: endpoint,
    })

    return response.data
}

export const updateNotificationEnabledEndpoint = (
    deviceID: string,
    accountID: string,
) => {
    return `/v1/devices/${deviceID}/accounts/${accountID}/`
}

export const updateNotificationEnabled = async (
    network: Network,
    deviceID: string,
    accountID: string,
    status: boolean,
) => {
    const endpoint = updateNotificationEnabledEndpoint(deviceID, accountID)
    const response = await queryClient<NotificationStatusResponse>({
        backend: 'pera',
        network,
        method: 'PATCH',
        url: endpoint,
        data: {
            receive_notifications: status,
        },
    })

    return response.data
}

export const getNotificationListEndpoint = (deviceID: string) => {
    return `/v1/devices/${deviceID}/notifications/`
}

export const fetchNotificationList = async (
    network: Network,
    deviceID: string,
    cursor?: string,
) => {
    const endpoint = getNotificationListEndpoint(deviceID)
    const response = await queryClient<NotificationsListResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: endpoint,
        params: {
            cursor,
        },
    })

    return response.data
}
