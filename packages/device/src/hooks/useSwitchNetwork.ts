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

import { useCallback, useState } from 'react'
import { useNetwork, useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { isNotFoundError, type Network } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useDeviceStore } from '../store'
import { createDevice, updateDevice } from './endpoints'

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

            const newDeviceId = deviceIDs.get(newNetwork) ?? null

            try {
                const platform = await deviceInfoService.getDevicePlatform()
                const model = deviceInfoService.getDeviceModel()
                const locale = deviceInfoService.getDeviceLocale()

                const registerDevice = async () => {
                    const result = await createDevice(newNetwork, {
                        accounts: addresses,
                        platform,
                        push_token: pushToken ?? undefined,
                        model,
                        application: 'pera',
                        locale,
                    })
                    setDeviceID(newNetwork, result.id ?? null)
                }

                if (!newDeviceId) {
                    await registerDevice()
                } else {
                    // A stored device ID the backend no longer knows (e.g. after
                    // an env reset or server-side deletion) 404s on update —
                    // re-register instead of failing the whole switch. Mirrors
                    // useDevice.registerDevice's 404 → createDevice fallback.
                    try {
                        await updateDevice(newNetwork, newDeviceId, {
                            accounts: addresses,
                            platform,
                            push_token: pushToken ?? undefined,
                            model,
                            application: 'pera',
                            locale,
                        })
                    } catch (error) {
                        if (!isNotFoundError(error)) throw error
                        await registerDevice()
                    }
                }

                setNetwork(newNetwork)

                // RootComponent's network-change effect picks up the
                // setNetwork() and calls clearDevicePushToken(oldNetwork, ...)
                // — single owner of "stop pushing to the previous network".
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
