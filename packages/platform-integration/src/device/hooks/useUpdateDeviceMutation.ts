import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import type { DeviceRequest, DeviceResponse } from '../models'
import { updateDevice } from './endpoints'
import { useNetwork } from './useNetwork'

export const useUpdateDeviceMutation = (
    options?: UseMutationOptions<
        DeviceResponse,
        Error,
        { deviceId: string; data: DeviceRequest }
    >,
) => {
    const { network } = useNetwork()
    return useMutation({
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
