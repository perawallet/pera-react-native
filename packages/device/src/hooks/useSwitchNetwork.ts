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

import { useCallback, useState } from 'react'
import { useNetwork, useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { logger, type Network } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useDeviceStore } from '../store'
import { createDevice, updateDevice, nullifyPushToken } from './endpoints'

type UseSwitchNetworkResult = {
    switchNetwork: (newNetwork: Network, addresses: string[]) => Promise<void>
    isSwitching: boolean
}

export const useSwitchNetwork = (): UseSwitchNetworkResult => {
    const { network } = useNetwork()
    const deviceIDs = useDeviceStore(state => state.deviceIDs)
    const pushToken = useDeviceStore(state => state.pushToken)
    const setDeviceID = useDeviceStore(state => state.setDeviceID)
    const setNetwork = useNetworkStore(state => state.setNetwork)
    const deviceInfoService = getProvider().deviceInfo

    const [isSwitching, setIsSwitching] = useState(false)

    const switchNetwork = useCallback(
        async (newNetwork: Network, addresses: string[]) => {
            if (newNetwork === network) {
                return
            }

            setIsSwitching(true)

            const oldNetwork = network
            const oldDeviceId = deviceIDs.get(oldNetwork) ?? null
            const newDeviceId = deviceIDs.get(newNetwork) ?? null

            try {
                const platform = await deviceInfoService.getDevicePlatform()
                const model = deviceInfoService.getDeviceModel()
                const locale = deviceInfoService.getDeviceLocale()

                if (!newDeviceId) {
                    const result = await createDevice(newNetwork, {
                        accounts: addresses,
                        platform,
                        push_token: pushToken ?? undefined,
                        model,
                        application: 'pera',
                        locale,
                    })
                    setDeviceID(newNetwork, result.id ?? null)
                } else {
                    await updateDevice(newNetwork, newDeviceId, {
                        accounts: addresses,
                        platform,
                        push_token: pushToken ?? undefined,
                        model,
                        locale,
                    })
                }

                setNetwork(newNetwork)

                if (oldDeviceId) {
                    nullifyPushToken(oldNetwork, oldDeviceId).catch(error => {
                        logger.warn(
                            'Failed to nullify push token on previous network',
                            { error },
                        )
                    })
                }
            } finally {
                setIsSwitching(false)
            }
        },
        [
            network,
            deviceIDs,
            pushToken,
            setDeviceID,
            setNetwork,
            deviceInfoService,
        ],
    )

    return { switchNetwork, isSwitching }
}
