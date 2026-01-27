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

import { queryClient } from '@perawallet/wallet-core-shared'
import type { DeviceRequest, DeviceResponse } from '../models'
import type { Network } from '@perawallet/wallet-core-shared'

const getUpdateEndpointPath = (deviceId: string) => `v1/devices/${deviceId}/`
const getCreateEndpointPath = () => `v1/devices/`

export const createDevice = async (network: Network, data: DeviceRequest) => {
    const response = await queryClient<DeviceResponse, DeviceRequest>({
        backend: 'pera',
        network,
        method: 'POST',
        url: getCreateEndpointPath(),
        data,
    })

    return response.data
}

export const updateDevice = async (
    network: Network,
    deviceId: string,
    data: DeviceRequest,
) => {
    const response = await queryClient<DeviceResponse, DeviceRequest>({
        backend: 'pera',
        network,
        method: 'PATCH',
        url: getUpdateEndpointPath(deviceId),
        data,
    })

    return response.data
}

export const deleteDevice = async (network: Network, data: DeviceRequest) => {
    const response = await queryClient<DeviceResponse, DeviceRequest>({
        backend: 'pera',
        network,
        method: 'DELETE',
        url: getUpdateEndpointPath(data.id ?? ''),
        data,
    })

    return response.data
}
