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

import { useCallback } from 'react'
import { useCreateDeviceMutation } from './useCreateDeviceMutation'
import { useUpdateDeviceMutation } from './useUpdateDeviceMutation'
import { useDeviceID } from './useDeviceID'
import { usePushToken } from './usePushToken'
import { useDeviceStore } from '../store'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { getProvider } from '@perawallet/wallet-extension-provider'

export const useDevice = () => {
    const deviceIDs = useDeviceStore(state => state.deviceIDs)
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const { pushToken } = usePushToken()
    const setDeviceID = useDeviceStore(state => state.setDeviceID)
    const deviceInfoService = getProvider().deviceInfo

    const { mutateAsync: createDevice } = useCreateDeviceMutation()
    const { mutateAsync: updateDevice } = useUpdateDeviceMutation()

    const registerDevice = useCallback(
        async (addresses: string[]) => {
            if (!deviceId) {
                const result = await createDevice({
                    data: {
                        accounts: addresses,
                        platform: await deviceInfoService.getDevicePlatform(),
                        push_token: pushToken ?? undefined,
                        model: deviceInfoService.getDeviceModel(),
                        application: 'pera',
                        locale: deviceInfoService.getDeviceLocale(),
                    },
                })
                setDeviceID(network, result.id ?? null)
            } else {
                await updateDevice({
                    deviceId,
                    data: {
                        accounts: addresses,
                        platform: await deviceInfoService.getDevicePlatform(),
                        push_token: pushToken ?? undefined,
                        model: deviceInfoService.getDeviceModel(),
                        locale: deviceInfoService.getDeviceLocale(),
                    },
                })
            }
        },
        [deviceId, deviceInfoService, pushToken, network, setDeviceID],
    )

    return {
        deviceIDs,
        setDeviceID,
        registerDevice,
    }
}
