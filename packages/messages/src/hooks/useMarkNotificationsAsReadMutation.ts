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
import { useMutation } from '@tanstack/react-query'
import type { WalletMode } from '@perawallet/wallet-core-chain-contract'
import { useDeploymentDeviceID } from '@perawallet/wallet-core-device'
import {
    useAnyEnabledChainHasCapability,
    useWalletDeployment,
} from '@perawallet/wallet-core-chain-shared'
import { updateLastSeenNotification } from '../api/notifications'
import { useInboxInvalidator } from './useInboxInvalidator'

// TanStack swaps a pending mutation's options on every render, so the deployment and device travel in the variables.
type MarkNotificationsAsReadVariables = {
    lastSeenNotificationId: number
    deployment: WalletMode
    deviceID: string
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
            onSuccess: () => {
                invalidate()
            },
            throwOnError: false,
        })

        // A ref keeps `markAsRead` stable while it still posts the deployment and device current at the call.
        const target = useRef({ deployment, deviceID: deviceID ?? '' })
        target.current = { deployment, deviceID: deviceID ?? '' }

        // The caller is an unmount effect with no UI to explain a doomed
        // request, so the guard lives here rather than at the call site.
        // Identity must stay stable: that effect lists `markAsRead` as a
        // dependency, so a fresh function each render would run its
        // mark-as-read cleanup on every render instead of on unmount.
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
