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
import type { DeviceResponse } from '../models'
import { deleteDevice } from './endpoints'
import { useDeviceID } from './useDevice'
import { Networks } from '@perawallet/wallet-core-shared'
import { useDeviceInfoService } from './useDeviceInfoService'
import { useDeviceStore } from '../store'

export const useDeleteDeviceMutation = (
    options?: UseMutationOptions<DeviceResponse[], Error, void>,
) => {
    const pushToken = useDeviceStore(state => state.pushToken)
    const testNetDeviceID = useDeviceID(Networks.testnet)
    const mainNetDeviceID = useDeviceID(Networks.mainnet)
    const deviceInfoService = useDeviceInfoService()
    return useMutation({
        mutationFn: async () => {
            const results: DeviceResponse[] = []
            if (testNetDeviceID && pushToken) {
                const testnet = await deleteDevice(Networks.testnet, {
                    id: testNetDeviceID,
                    push_token: pushToken,
                    platform: deviceInfoService.getDevicePlatform(),
                    accounts: [],
                })
                results.push(testnet)
            }
            if (mainNetDeviceID && pushToken) {
                const mainnet = await deleteDevice(Networks.mainnet, {
                    id: mainNetDeviceID,
                    push_token: pushToken,
                    platform: deviceInfoService.getDevicePlatform(),
                    accounts: [],
                })
                results.push(mainnet)
            }
            return results
        },
        ...options,
    })
}
