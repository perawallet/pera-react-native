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
import {
    useDeviceID,
    useNetwork,
} from '@perawallet/wallet-core-platform-integration'
import {
    fetchNotificationStatus,
    type NotificationStatusResponse,
} from '../api/notifications'
import { config } from '@perawallet/wallet-core-config'
import { useCallback } from 'react'
import { getNotificationStatusQueryKey } from './querykeys'
import { useInboxQuery } from './useInboxQuery'

export const useInboxStatus = () => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)

    const { data: inboxData } = useInboxQuery()

    const { data: notificationStatusData } = useQuery({
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

    return {
        hasUnreadItems:
            inboxData?.length || notificationStatusData?.hasNewNotification,
        hasUnreadInboxItems: inboxData?.length,
        hasUnreadNotifications: notificationStatusData?.hasNewNotification
    }
}
