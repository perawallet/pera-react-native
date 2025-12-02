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

import { useCallback } from 'react'
import { useDeviceID, useNetwork } from '../../device'
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'
import { fetchNotificationList } from './endpoints'
import type {
    NotificationResponse,
    NotificationsListResponse,
    PeraNotification,
} from '../models'
import { getNotificationsListQueryKey } from './querykeys'

const mapNotificationResponseToNotification = (
    response: NotificationResponse,
): PeraNotification => {
    return {
        id: response.id,
        title: response.title,
        message: response.message,
        createdAt: new Date(response.creation_datetime),
        metadata: response.metadata
            ? (response.metadata as Record<string, unknown>)
            : {},
    }
}

export const useNotificationsListQuery = () => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)

    return useInfiniteQuery({
        queryKey: getNotificationsListQueryKey(network, deviceID!),
        queryFn: ({ pageParam }) =>
            fetchNotificationList(
                network,
                deviceID!,
                pageParam as string | undefined,
            ),
        initialPageParam: '',
        getNextPageParam: lastPage => {
            return lastPage.next
        },
        getPreviousPageParam: firstPage => {
            return firstPage.previous
        },
        enabled: !!deviceID,
        select: useCallback((data: InfiniteData<NotificationsListResponse>) => {
            return data.pages.flatMap((p: NotificationsListResponse) =>
                p.results.map((r: NotificationResponse) =>
                    mapNotificationResponseToNotification(r),
                ),
            )
        }, []),
    })
}
