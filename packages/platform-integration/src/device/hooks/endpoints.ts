import {
    queryClient,
    type ResponseErrorConfiguration,
} from '@perawallet/wallet-core-shared'
import type { DeviceRequest, DeviceResponse } from '../models'
import type { Network } from '@perawallet/wallet-core-shared'

const getUpdateEndpointPath = (deviceId: string) => `v1/devices/${deviceId}/`
const getCreateEndpointPath = () => `v1/devices/`

export const createDevice = async (network: Network, data: DeviceRequest) => {
    const response = await queryClient<
        DeviceResponse,
        ResponseErrorConfiguration<Error>,
        DeviceRequest
    >({
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
    const response = await queryClient<
        DeviceResponse,
        ResponseErrorConfiguration<Error>,
        DeviceRequest
    >({
        backend: 'pera',
        network,
        method: 'PATCH',
        url: getUpdateEndpointPath(deviceId),
        data,
    })

    return response.data
}
