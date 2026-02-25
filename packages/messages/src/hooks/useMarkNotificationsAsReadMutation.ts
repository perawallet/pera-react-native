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

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
    useDeviceID,
    useNetwork,
} from '@perawallet/wallet-core-platform-integration'
import { updateLastSeenNotification } from '../api/notifications'
import {
    getNotificationsListQueryKey,
    getNotificationStatusQueryKey,
} from './querykeys'

type UseMarkNotificationsAsReadMutationResult = {
    markAsRead: (lastSeenNotificationId: number) => void
}

export const useMarkNotificationsAsReadMutation =
    (): UseMarkNotificationsAsReadMutationResult => {
        const { network } = useNetwork()
        const deviceID = useDeviceID(network)
        const queryClient = useQueryClient()

        const { mutate } = useMutation({
            mutationFn: (lastSeenNotificationId: number) =>
                updateLastSeenNotification(
                    network,
                    deviceID ?? '',
                    lastSeenNotificationId,
                ),
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: getNotificationsListQueryKey(
                        network,
                        deviceID ?? '',
                    ),
                })
                queryClient.invalidateQueries({
                    queryKey: getNotificationStatusQueryKey(
                        network,
                        deviceID ?? '',
                    ),
                })
            },
        })

        return {
            markAsRead: mutate,
        }
    }
