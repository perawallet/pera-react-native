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
import { useQueryClient } from '@tanstack/react-query'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import { logger, type Network } from '@perawallet/wallet-core-shared'
import { updateNotificationEnabled } from '../api/notifications'
import { useNotificationsStore } from '../store'
import {
    getMessageStatusQueryKey,
    getNotificationStatusQueryKey,
    getNotificationsListQueryKey,
} from './querykeys'

/**
 * Re-pushes locally muted accounts to the backend after a device record is
 * created from scratch (fresh install path or a migration that could not
 * carry the legacy device id). The backend defaults new device-account rows
 * to notifying, which would undo mutes the user set in Pera 6.
 *
 * Takes the network as an argument (rather than `useNetwork()`) because the
 * caller is `useDeviceRegistration`'s `onDeviceCreated`, which reports the
 * network the registration actually ran against.
 */
export const useReplayNotificationMutes = (): ((network: Network) => void) => {
    const queryClient = useQueryClient()
    return useCallback(
        (network: Network) => {
            const muted =
                useNotificationsStore.getState().notificationDisabledAccounts
            if (muted.length === 0) return
            const deviceID = useDeviceStore.getState().deviceIDs.get(network)
            if (!deviceID) return
            void Promise.all(
                muted.map(address =>
                    updateNotificationEnabled(
                        network,
                        deviceID,
                        address,
                        false,
                    ).then(
                        () => true,
                        error => {
                            logger.warn('Notification mute replay failed', {
                                source: 'useReplayNotificationMutes',
                                address,
                                error,
                            })
                            return false
                        },
                    ),
                ),
            ).then(results => {
                if (!results.includes(true)) return
                // Same resets as useAccountNotificationEnabledMutation's
                // onSuccess: the replay changes which accounts notify, so the
                // badge/list caches keyed on this device are stale until reset.
                void queryClient.resetQueries({
                    queryKey: getMessageStatusQueryKey(network, deviceID),
                })
                void queryClient.resetQueries({
                    queryKey: getNotificationStatusQueryKey(network, deviceID),
                })
                void queryClient.resetQueries({
                    queryKey: getNotificationsListQueryKey(network, deviceID),
                })
            })
        },
        [queryClient],
    )
}
