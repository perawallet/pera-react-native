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

import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { deleteDevice } from './endpoints'
import { useDeploymentDeviceID } from './useDeviceID'

export const useDeleteDeviceMutation = (
    options?: UseMutationOptions<void, Error, void>,
) => {
    const developerDeviceID = useDeploymentDeviceID('developer')
    const liveDeviceID = useDeploymentDeviceID('live')
    return useMutation({
        mutationFn: async () => {
            // v3 takes `id` alone and prefers it over a push token when both
            // are sent, so a device whose push token was never granted can
            // still be deleted — v1 could not.
            if (developerDeviceID) {
                await deleteDevice('developer', { id: developerDeviceID })
            }
            if (liveDeviceID) {
                await deleteDevice('live', { id: liveDeviceID })
            }
        },
        ...options,
    })
}
