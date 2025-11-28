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

import { useQuery } from '@tanstack/react-query'
import { useDeviceID, useNetwork } from '../../device'
import { fetchNotificationStatus } from './endpoints'
import type { Network } from '@perawallet/wallet-core-shared'
import { config } from '@perawallet/wallet-core-config'
import { useCallback } from 'react'
import type { NotificationStatusResponse } from '../models'

export const getNotificationStatusQueryKey = (
    network: Network,
    deviceID: string,
) => {
    return ['v1', 'devices', deviceID, 'notification-status', network]
}

export const useNotificationStatus = () => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    return useQuery({
        queryKey: getNotificationStatusQueryKey(network, deviceID ?? ''),
        queryFn: () => fetchNotificationStatus(network, deviceID ?? ''),
        enabled: !!deviceID,
        refetchInterval: config.notificationRefreshTime,
        select: useCallback((data: NotificationStatusResponse) => {
            return {
                hasNewNotification: data.has_new_notification,
            }
        }, []),
    })
}
