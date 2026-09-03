/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'
import {
    fetchNotificationList,
    type NotificationResponse,
    type NotificationsListResponse,
} from '../api/notifications'
import type { PeraNotification } from '../models'
import { getNotificationsListQueryKey } from './querykeys'
import type { Maybe, Nullable, Optional } from '@perawallet/wallet-core-shared'

const mapNotificationResponseToNotification = (
    response: NotificationResponse,
): PeraNotification => ({
    id: response.id,
    type: response.type,
    accountAddress: response.account_address,
    message: response.message,
    url: response.url,
    createdAt: new Date(response.creation_datetime),
    isUnread: response.is_unread,
    icon: response.icon ?? null,
})

const extractCursor = (url: Nullable<string>): Maybe<string> => {
    if (!url) return undefined
    try {
        return new URL(url).searchParams.get('cursor') ?? undefined
    } catch {
        return undefined
    }
}

export type UseNotificationsListQueryResult = {
    data: PeraNotification[]
    isPending: boolean
    isFetchingNextPage: boolean
    isRefetching: boolean
    fetchNextPage: () => void
    refetch: () => void
    /** True when the active network has no Pera backend — this can never succeed here. */
    isUnavailableOnNetwork: boolean
    /**
     * On a Pera-backed network but with no device id yet (push registration
     * hasn't landed — denied permission, FCM failure, first-run POST not yet
     * succeeded). The query stays disabled, so the screen shows a terminal
     * "unavailable" message instead of an empty inbox it can't distinguish from.
     */
    isDeviceUnregistered: boolean
}

export const useNotificationsListQuery =
    (): UseNotificationsListQueryResult => {
        const { network } = useNetwork()
        const deviceID = useDeviceID(network)
        const isUnavailableOnNetwork = !isPeraBackedNetwork(network)
        const isEnabled = !!deviceID?.length && !isUnavailableOnNetwork

        const query = useInfiniteQuery({
            queryKey: getNotificationsListQueryKey(network, deviceID!),
            queryFn: ({ pageParam }) =>
                fetchNotificationList(
                    network,
                    deviceID ?? '',
                    pageParam as Optional<string>,
                ),
            initialPageParam: '',
            getNextPageParam: lastPage => extractCursor(lastPage.next),
            getPreviousPageParam: firstPage =>
                extractCursor(firstPage.previous),
            enabled: isEnabled,
            select: useCallback(
                (data: InfiniteData<NotificationsListResponse>) => {
                    return data.pages.flatMap((p: NotificationsListResponse) =>
                        p.results.map((r: NotificationResponse) =>
                            mapNotificationResponseToNotification(r),
                        ),
                    )
                },
                [],
            ),
        })

        return {
            data: query.data ?? [],
            // A disabled query never leaves `status: 'pending'` in React Query
            // v5, so `query.isPending` stays true forever while gated off. Only
            // report loading when the query can actually run, otherwise the
            // empty view spins indefinitely.
            isPending: isEnabled ? query.isPending : false,
            isDeviceUnregistered: !isUnavailableOnNetwork && !deviceID?.length,
            isFetchingNextPage: isUnavailableOnNetwork
                ? false
                : query.isFetchingNextPage,
            isRefetching: isUnavailableOnNetwork ? false : query.isRefetching,
            // The observer's fetchNextPage()/refetch() ignore `enabled` and would
            // still fire the doomed Pera request on a non-backed network.
            fetchNextPage: () => {
                if (isUnavailableOnNetwork) return
                void query.fetchNextPage()
            },
            refetch: () => {
                if (isUnavailableOnNetwork) return
                void query.refetch()
            },
            isUnavailableOnNetwork,
        }
    }
