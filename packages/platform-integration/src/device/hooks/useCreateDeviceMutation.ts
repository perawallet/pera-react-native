import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import type { DeviceRequest, DeviceResponse } from '../models'
import { createDevice } from './endpoints'
import { useNetwork } from './useNetwork'

export const useCreateDeviceMutation = (
    options?: UseMutationOptions<
        DeviceResponse,
        Error,
        { data: DeviceRequest }
    >,
) => {
    const { network } = useNetwork()
    return useMutation({
        mutationFn: ({ data }: { data: DeviceRequest }) =>
            createDevice(network, data),
        ...options,
    })
}
