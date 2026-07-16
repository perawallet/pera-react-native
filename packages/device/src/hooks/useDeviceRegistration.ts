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

import { useEffect } from 'react'
import {
    useNetwork,
    useOnNetworkSwitch,
} from '@perawallet/wallet-core-blockchain'
import { logger } from '@perawallet/wallet-core-shared'

import { useDevice } from './useDevice'

/**
 * Drives best-effort device registration off network and account changes.
 * Mirrors Android's `DeviceRegistrationUseCase`; failures are logged, never
 * thrown.
 */
export const useDeviceRegistration = (addresses: string[]): void => {
    const { network } = useNetwork()
    const { registerDevice, clearDevicePushToken } = useDevice()

    // Callers typically derive `addresses` from the accounts store array,
    // which gets a new reference on every store write (incl. background sync
    // ticks). Key the effect on the sorted, joined address set so it only
    // refires when membership actually changes — one store write or a
    // reorder must not mean one device PUT.
    const addressesKey = [...addresses].sort().join('\n')

    // Stop the server pushing to the network we just left.
    useOnNetworkSwitch(previousNetwork => {
        clearDevicePushToken(previousNetwork).catch(error => {
            logger.warn('Device push-token cleanup failed', {
                source: 'useDeviceRegistration',
                error,
            })
        })
    })

    // (Re)register on mount, when the account set changes, and on the new
    // network after a switch.
    useEffect(() => {
        const stableAddresses = addressesKey ? addressesKey.split('\n') : []
        registerDevice(stableAddresses).catch(error => {
            logger.warn('Device registration failed', {
                source: 'useDeviceRegistration',
                error,
            })
        })
    }, [addressesKey, network, registerDevice])
}
