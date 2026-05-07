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

import { useEffect, useRef } from 'react'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { logger } from '@perawallet/wallet-core-shared'

import { useDevice } from './useDevice'

/**
 * Drives device registration as a side-effect of network and account changes.
 *
 * On a real network switch, detaches the push token from the previous
 * network's device first so the server stops pushing to a node we've moved
 * away from, then re-registers on the new network. Mirrors Android's
 * `DeviceRegistrationUseCase` orchestration.
 *
 * Failures are logged but never thrown — registration is best-effort, and
 * the next render or app foreground naturally retries.
 *
 * `addresses` must be a stable reference across renders when its contents
 * are unchanged (memoize at the call site); otherwise the effect refires
 * on every render.
 */
export const useDeviceRegistration = (addresses: string[]): void => {
    const { network } = useNetwork()
    const { registerDevice, clearDevicePushToken } = useDevice()
    const previousNetworkRef = useRef(network)

    useEffect(() => {
        const previousNetwork = previousNetworkRef.current
        const isNetworkSwitch = previousNetwork !== network
        previousNetworkRef.current = network

        const run = async () => {
            if (isNetworkSwitch) {
                await clearDevicePushToken(previousNetwork)
            }
            await registerDevice(addresses)
        }

        run().catch(error => {
            logger.warn('Device registration failed', {
                source: 'useDeviceRegistration',
                error,
            })
        })
    }, [addresses, network, registerDevice, clearDevicePushToken])
}
