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
import { useMutation } from '@tanstack/react-query'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import { updateLastSeenNotification } from '../api/notifications'
import { useInboxInvalidator } from './useInboxInvalidator'

type UseMarkNotificationsAsReadMutationResult = {
    markAsRead: (lastSeenNotificationId: number) => void
    /** True when the active network has no Pera backend — this can never succeed here. */
    isUnavailableOnNetwork: boolean
}

export const useMarkNotificationsAsReadMutation =
    (): UseMarkNotificationsAsReadMutationResult => {
        const { network } = useNetwork()
        const deviceID = useDeviceID(network)
        const isUnavailableOnNetwork = !isPeraBackedNetwork(network)
        const { invalidate } = useInboxInvalidator()

        const { mutate } = useMutation({
            mutationFn: (lastSeenNotificationId: number) =>
                updateLastSeenNotification(
                    network,
                    deviceID ?? '',
                    lastSeenNotificationId,
                ),
            onSuccess: () => {
                invalidate()
            },
            throwOnError: false,
        })

        // The caller is an unmount effect with no UI to explain a doomed
        // request, so the guard lives here rather than at the call site.
        // Identity must stay stable: that effect lists `markAsRead` as a
        // dependency, so a fresh function each render would run its
        // mark-as-read cleanup on every render instead of on unmount.
        const markAsRead = useCallback(
            (lastSeenNotificationId: number) => {
                if (isUnavailableOnNetwork) return
                mutate(lastSeenNotificationId)
            },
            [isUnavailableOnNetwork, mutate],
        )

        return {
            markAsRead,
            isUnavailableOnNetwork,
        }
    }
