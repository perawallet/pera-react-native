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

import { useMutation } from '@tanstack/react-query'
import { useDeviceID } from '@perawallet/wallet-extension-platform'
import { useNetwork } from '@perawallet/wallet-extension-network'
import { updateLastSeenNotification } from '../api/notifications'
import { useInboxInvalidator } from './useInboxInvalidator'

type UseMarkNotificationsAsReadMutationResult = {
    markAsRead: (lastSeenNotificationId: number) => void
}

export const useMarkNotificationsAsReadMutation =
    (): UseMarkNotificationsAsReadMutationResult => {
        const { network } = useNetwork()
        const deviceID = useDeviceID(network)
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
        })

        return {
            markAsRead: mutate,
        }
    }
