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
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { updateNotificationEnabled } from '../api/notifications'
import { useQueryClient } from '@tanstack/react-query'
import {
    getNotificationsListQueryKey,
    getNotificationStatusQueryKey,
} from './querykeys'

export const useAccountNotificationEnabledMutation = () => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const queryClient = useQueryClient()
    return useMutation({
        // The global mutation config sets throwOnError: true so that
        // unhandled mutation errors surface to the nearest ErrorBoundary.
        // The notification toggle handler wraps mutateAsync in a .catch()
        // that rolls back the optimistic update and shows a toast — so we
        // opt out here. Otherwise a network failure would re-throw on the
        // next render and crash the settings screen after the toast had
        // already been shown, making the toggle appear to silently revert.
        throwOnError: false,
        mutationFn: ({
            accountID,
            status,
        }: {
            accountID: string
            status: boolean
        }) =>
            updateNotificationEnabled(
                network,
                deviceID ?? '',
                accountID,
                status,
            ),
        onSuccess: () => {
            queryClient.resetQueries({
                queryKey: getNotificationStatusQueryKey(
                    network,
                    deviceID ?? '',
                ),
            })
            queryClient.resetQueries({
                queryKey: getNotificationsListQueryKey(network, deviceID ?? ''),
            })
        },
    })
}
