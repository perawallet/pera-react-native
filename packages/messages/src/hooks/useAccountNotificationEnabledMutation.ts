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

import { useMutation } from '@tanstack/react-query'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { assertOnline } from '@perawallet/wallet-core-shared'
import { updateNotificationEnabled } from '../api/notifications'
import { useQueryClient } from '@tanstack/react-query'
import {
    getNotificationsListQueryKey,
    getMessageStatusQueryKey,
    getNotificationStatusQueryKey,
} from './querykeys'

export const useAccountNotificationEnabledMutation = () => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const queryClient = useQueryClient()
    return useMutation({
        // `mutationDefaults` (@perawallet/wallet-core-shared) already sets
        // throwOnError: false; this mirrors it locally. The notification toggle
        // handler wraps mutateAsync in a .catch() that rolls back the optimistic
        // update and shows a toast. Re-throwing on the next render (TanStack
        // keeps mutation.error until reset()) would crash the settings screen
        // after the toast, making the toggle appear to silently revert.
        throwOnError: false,
        mutationFn: ({
            accountID,
            status,
        }: {
            accountID: string
            status: boolean
        }) => {
            // Fail fast offline instead of trusting the native transport to
            // reject. Under networkMode 'always' the mutationFn runs even when
            // offline; iOS rejects the request promptly but Android (airplane
            // mode) does not, so the toggle handler's optimistic-rollback never
            // ran and the persisted store diverged from the backend. Mirrors
            // the money-flow mutations (opt-in, rekey, swaps-prepare).
            assertOnline()

            return updateNotificationEnabled(
                network,
                deviceID ?? '',
                accountID,
                status,
            )
        },
        onSuccess: () => {
            // Reset both the primary (v3) and fallback (v1) badge sources so
            // the badge refreshes regardless of which one is currently active.
            void queryClient.resetQueries({
                queryKey: getMessageStatusQueryKey(network, deviceID ?? ''),
            })
            void queryClient.resetQueries({
                queryKey: getNotificationStatusQueryKey(
                    network,
                    deviceID ?? '',
                ),
            })
            void queryClient.resetQueries({
                queryKey: getNotificationsListQueryKey(network, deviceID ?? ''),
            })
        },
    })
}
