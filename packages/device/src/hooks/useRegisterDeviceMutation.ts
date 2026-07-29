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
import type { Network } from '@perawallet/wallet-core-shared'
import type { DeviceRegistration, DeviceResponse } from '../models'
import { registerDevice } from './endpoints'

/**
 * Variables for one registration write.
 *
 * `network` is a mutation *variable*, not a `useNetwork()` read inside the
 * hook: `useDevice.registerDevice` queues registrations, so a call can be
 * enqueued on one network and actually run after the user has switched to
 * another. Re-reading the current network at execution time would send the
 * first network's device id to the second network's backend. The caller
 * captures the target at enqueue time and passes it here.
 */
export type RegisterDeviceVariables = {
    network: Network
    data: DeviceRegistration
}

/**
 * v3 has one write verb: a payload carrying `id` updates that device, one
 * without creates a new one. `useDevice.registerDevice` owns that decision;
 * this hook is the transport.
 */
export const useRegisterDeviceMutation = (
    options?: UseMutationOptions<
        DeviceResponse,
        Error,
        RegisterDeviceVariables
    >,
) =>
    useMutation({
        // Device registration is best-effort and handled by
        // `useDeviceRegistration` (logs and swallows). Opt out of the global
        // `throwOnError: true` so a failed registration doesn't re-throw on
        // the next render and crash the app.
        throwOnError: false,
        mutationFn: ({ network, data }: RegisterDeviceVariables) =>
            registerDevice(network, data),
        ...options,
    })
