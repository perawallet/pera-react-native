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

import { queryClient } from '@perawallet/wallet-core-shared'
import { config } from '@perawallet/wallet-core-config'
import type { Network } from '@perawallet/wallet-core-shared'
import type {
    DeviceDeleteRequest,
    DeviceRegistration,
    DeviceRegistrationRequest,
    DeviceResponse,
} from '../models'
import { toDeviceRegistrationRequest } from './serializers'

/** No trailing slash — the v3 routes differ from v1 in this. */
const DEVICES_PATH = 'api/v3/devices'

/**
 * v3 authenticates with its own key. Falls back to the v1 key while
 * `BACKEND_API_KEY_V3` is unset so local and CI builds without the secret
 * still reach the backend. The shared client only fills in the default key
 * when the request didn't set one (see `setStandardHeaders`).
 */
const deviceApiHeaders = (): Record<string, string> => ({
    'x-api-key': config.backendAPIKeyV3 || config.backendAPIKey,
})

/**
 * Create or update a device. v3 has no separate update verb: a payload
 * carrying `id` updates that device, one without creates a new one.
 */
export const registerDevice = async (
    network: Network,
    registration: DeviceRegistration,
): Promise<DeviceResponse> => {
    const response = await queryClient<
        DeviceResponse,
        DeviceRegistrationRequest
    >({
        backend: 'pera',
        network,
        method: 'POST',
        url: DEVICES_PATH,
        data: toDeviceRegistrationRequest(registration),
        headers: deviceApiHeaders(),
    })

    return response.data
}

export const deleteDevice = async (
    network: Network,
    data: DeviceDeleteRequest,
): Promise<void> => {
    await queryClient<string, DeviceDeleteRequest>({
        backend: 'pera',
        network,
        method: 'DELETE',
        url: DEVICES_PATH,
        data,
        responseType: 'text',
        headers: deviceApiHeaders(),
    })
}
