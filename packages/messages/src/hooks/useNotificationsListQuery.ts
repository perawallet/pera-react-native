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
import { useDeploymentDeviceID } from '@perawallet/wallet-core-device'
import {
    useAnyEnabledChainHasCapability,
    useWalletDeployment,
} from '@perawallet/wallet-core-chain-shared'
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'
import {
    fetchNotificationList,
    type NotificationResponse,
    type NotificationsListResponse,
} from '../api/notifications'
import type { PeraNotification } from '../models'
import { getNotificationsListQueryKey } from './querykeys'
import { getQueryRenderState } from '@perawallet/wallet-core-shared'
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
        // The API's last page can carry `next` with an EMPTY `?cursor=`.
        // `''` is not nullish, and React Query reads any non-nullish page
        // param as "there is a next page" — so `?? undefined` alone loops
        // page one forever (one request per onEndReached tick, spinner
        // pinned). Empty must collapse to undefined.
        return new URL(url).searchParams.get('cursor') || undefined
    } catch {
        return undefined
    }
}

export type UseNotificationsListQueryResult = {
    data: PeraNotification[]
    isPending: boolean
    /** Paused by offline `networkMode: 'online'` gating with nothing cached — render the offline surface, not a spinner (docs/OFFLINE_PAUSED_STATE.md). */
    isPaused: boolean
    /** The fetch failed while the query was allowed to run — pair with a retry affordance. */
    isError: boolean
    /** The failure behind `isError`, for callers that branch on its kind (an integrity refusal); null otherwise. */
    error: unknown
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
        const deployment = useWalletDeployment()
        const deviceID = useDeploymentDeviceID(deployment)
        const isUnavailableOnNetwork =
            !useAnyEnabledChainHasCapability('notifications')
        const isEnabled = !!deviceID?.length && !isUnavailableOnNetwork

        const query = useInfiniteQuery({
            queryKey: getNotificationsListQueryKey(deployment, deviceID!),
            queryFn: ({ pageParam }) =>
                fetchNotificationList(
                    deployment,
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

        const { isPaused, isError } = getQueryRenderState(query)

        // The observer's fetchNextPage()/refetch() ignore `enabled` and would
        // still fire the doomed Pera request on a non-backed network, or with
        // no device id (`/v2/devices//notifications/`, a 404). Both guards
        // MUST be referentially stable: NotificationsScreen refetches on
        // focus with `refetch` in its effect deps, so a per-render identity
        // re-runs the effect after every render the refetch itself causes — an
        // infinite request loop with the refresh spinner pinned.
        const { fetchNextPage: fetchNextQueryPage, refetch: refetchQuery } =
            query
        const fetchNextPage = useCallback(() => {
            if (!isEnabled) return
            void fetchNextQueryPage()
        }, [isEnabled, fetchNextQueryPage])

        const refetch = useCallback(() => {
            if (!isEnabled) return
            void refetchQuery()
        }, [isEnabled, refetchQuery])

        return {
            data: query.data ?? [],
            // Disabled and paused queries never leave `status: 'pending'` in
            // React Query v5, so raw `query.isPending` stays true forever while
            // gated off (no device id) or offline. Only report loading when a
            // fetch can actually run, otherwise the empty view spins
            // indefinitely.
            isPending: isEnabled && !isPaused ? query.isPending : false,
            isPaused,
            isError,
            error: query.error ?? null,
            isDeviceUnregistered: !isUnavailableOnNetwork && !deviceID?.length,
            isFetchingNextPage: isUnavailableOnNetwork
                ? false
                : query.isFetchingNextPage,
            isRefetching: isUnavailableOnNetwork ? false : query.isRefetching,
            fetchNextPage,
            refetch,
            isUnavailableOnNetwork,
        }
    }
