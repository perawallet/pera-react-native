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

import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import type { DeviceRequest, DeviceResponse } from '../models'
import { updateDevice } from './endpoints'
import { useNetwork } from '@perawallet/wallet-core-blockchain'

export const useUpdateDeviceMutation = (
    options?: UseMutationOptions<
        DeviceResponse,
        Error,
        { deviceId: string; data: DeviceRequest }
    >,
) => {
    const { network } = useNetwork()
    return useMutation({
        // Device registration is best-effort: a failed update (notably a 404
        // for a device ID the backend no longer knows — e.g. after an env
        // switch) is handled by `useDevice.registerDevice`, which re-registers
        // the device, and by `useDeviceRegistration`, which logs and swallows.
        // Mirrors `mutationDefaults` (@perawallet/wallet-core-shared), which
        // already sets throwOnError: false — re-throwing an already-handled
        // error on the next render would crash the app with a render error.
        throwOnError: false,
        mutationFn: ({
            deviceId,
            data,
        }: {
            deviceId: string
            data: DeviceRequest
        }) => updateDevice(network, deviceId, data),
        ...options,
    })
}
