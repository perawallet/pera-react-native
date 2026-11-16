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

import { useCallback, useRef } from 'react'
import {
    type InfiniteData,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query'
import type { WalletMode } from '@perawallet/wallet-core-chain-contract'
import { useDeploymentDeviceID } from '@perawallet/wallet-core-device'
import {
    useAnyEnabledChainHasCapability,
    useWalletDeployment,
} from '@perawallet/wallet-core-chain-shared'
import {
    updateLastSeenNotification,
    type MessageStatusResponse,
    type NotificationStatusResponse,
    type NotificationsListResponse,
} from '../api/notifications'
import {
    getMessageStatusQueryKey,
    getNotificationStatusQueryKey,
    getNotificationsListQueryKey,
} from './querykeys'
import {
    markMessageStatusNotificationsRead,
    markNotificationsReadUpTo,
} from './readState'
import { useInboxInvalidator } from './useInboxInvalidator'

// TanStack swaps a pending mutation's options on every render, so the deployment and device travel in the variables.
type MarkNotificationsAsReadVariables = {
    lastSeenNotificationId: number
    deployment: WalletMode
    deviceID: string
}

type ReadStateSnapshot = {
    list?: InfiniteData<NotificationsListResponse>
    messageStatus?: MessageStatusResponse
    notificationStatus?: NotificationStatusResponse
}

type UseMarkNotificationsAsReadMutationResult = {
    markAsRead: (lastSeenNotificationId: number) => void
    /** True when the active network has no Pera backend — this can never succeed here. */
    isUnavailableOnNetwork: boolean
}

export const useMarkNotificationsAsReadMutation =
    (): UseMarkNotificationsAsReadMutationResult => {
        const deployment = useWalletDeployment()
        const deviceID = useDeploymentDeviceID(deployment)
        const isUnavailableOnNetwork =
            !useAnyEnabledChainHasCapability('notifications')
        const { invalidate } = useInboxInvalidator()
        const queryClient = useQueryClient()

        const { mutate } = useMutation({
            mutationFn: ({
                lastSeenNotificationId,
                deployment,
                deviceID,
            }: MarkNotificationsAsReadVariables) =>
                updateLastSeenNotification(
                    deployment,
                    deviceID,
                    lastSeenNotificationId,
                ),
            // Clear the dots and badges now rather than after the PUT and the
            // refetch it triggers: "Mark all as read" otherwise looks inert.
            onMutate: async ({
                lastSeenNotificationId,
                deployment,
                deviceID,
            }): Promise<ReadStateSnapshot> => {
                const listKey = getNotificationsListQueryKey(
                    deployment,
                    deviceID,
                )
                const messageStatusKey = getMessageStatusQueryKey(
                    deployment,
                    deviceID,
                )
                const notificationStatusKey = getNotificationStatusQueryKey(
                    deployment,
                    deviceID,
                )
                await Promise.all([
                    queryClient.cancelQueries({ queryKey: listKey }),
                    queryClient.cancelQueries({ queryKey: messageStatusKey }),
                    queryClient.cancelQueries({
                        queryKey: notificationStatusKey,
                    }),
                ])

                const snapshot: ReadStateSnapshot = {
                    list: queryClient.getQueryData(listKey),
                    messageStatus: queryClient.getQueryData(messageStatusKey),
                    notificationStatus: queryClient.getQueryData(
                        notificationStatusKey,
                    ),
                }

                if (snapshot.list) {
                    queryClient.setQueryData(
                        listKey,
                        markNotificationsReadUpTo(
                            snapshot.list,
                            lastSeenNotificationId,
                        ),
                    )
                }
                if (snapshot.messageStatus) {
                    queryClient.setQueryData(
                        messageStatusKey,
                        markMessageStatusNotificationsRead(
                            snapshot.messageStatus,
                        ),
                    )
                }
                if (snapshot.notificationStatus) {
                    queryClient.setQueryData<NotificationStatusResponse>(
                        notificationStatusKey,
                        { has_new_notification: false },
                    )
                }

                return snapshot
            },
            onError: (_error, { deployment, deviceID }, snapshot) => {
                if (!snapshot) return
                queryClient.setQueryData(
                    getNotificationsListQueryKey(deployment, deviceID),
                    snapshot.list,
                )
                queryClient.setQueryData(
                    getMessageStatusQueryKey(deployment, deviceID),
                    snapshot.messageStatus,
                )
                queryClient.setQueryData(
                    getNotificationStatusQueryKey(deployment, deviceID),
                    snapshot.notificationStatus,
                )
            },
            // Settled, not success: a rollback restores the pre-tap snapshot,
            // which may predate a push that landed meanwhile.
            onSettled: () => {
                invalidate()
            },
            throwOnError: false,
        })

        // One caller is an unmount effect with no UI to explain a doomed
        // request, so the guard lives here rather than at the call site.
        // Identity must stay stable: that effect lists `markAsRead` as a
        // dependency, so a fresh function each render would run its
        // mark-as-read cleanup on every render instead of on unmount. The ref
        // keeps it stable while still posting the deployment and device
        // current at the call.
        const target = useRef({ deployment, deviceID: deviceID ?? '' })
        target.current = { deployment, deviceID: deviceID ?? '' }

        const markAsRead = useCallback(
            (lastSeenNotificationId: number) => {
                if (isUnavailableOnNetwork) return
                mutate({ lastSeenNotificationId, ...target.current })
            },
            [isUnavailableOnNetwork, mutate],
        )

        return {
            markAsRead,
            isUnavailableOnNetwork,
        }
    }
