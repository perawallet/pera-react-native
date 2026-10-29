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

import { queryClient } from '@perawallet/wallet-core-shared'
import type {
    ChainId,
    WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type {
    DeviceDeleteRequest,
    DeviceRegistration,
    DeviceRegistrationRequest,
    DeviceResponse,
    V3DeviceRegistrationRequest,
} from '../models'
import {
    deviceChainAdapters,
    type DeviceRegistrableAccount,
} from '../registrations/chain-adapter'
import { registrationChainOf } from '../registrations/registrationChain'
import { isDeviceRegistrationV4Enabled } from './registrationApi'
import {
    toDeviceRegistrationRequest,
    toV3DeviceRegistrationRequest,
} from './serializers'

// The backend's devices contract adds no v4 delete; its v3 delete removes the same device row v4 writes.
const REGISTER_DEVICE_PATH = 'api/v4/devices/'
/** No trailing slash — the v3 routes differ from v1 and v4 in this. */
const V3_DEVICES_PATH = 'api/v3/devices'

const isOnV3DevicesApi = (chainId: ChainId): boolean =>
    deviceChainAdapters.has(chainId) &&
    deviceChainAdapters.get(chainId).isOnV3DevicesApi === true

/**
 * Whether registering on `deployment` sends the account's address on `chainId`,
 * so a push can reach it there. The chain's `notifications` capability plays no
 * part: a device adapter registers whatever it says.
 */
export const isSentInDeviceRegistration = (
    account: DeviceRegistrableAccount,
    chainId: ChainId,
    deployment: WalletMode,
): boolean => {
    if (account.chains[chainId] === undefined) return false
    if (!deviceChainAdapters.has(chainId)) return false
    if (deviceChainAdapters.get(chainId).accountTypeOf(account) === null) {
        return false
    }
    return isDeviceRegistrationV4Enabled()
        ? registrationChainOf(getProvider().chains, chainId, deployment) !==
              null
        : isOnV3DevicesApi(chainId)
}

/**
 * Create or update a device. There is no separate update verb: a payload
 * carrying `id` updates that device, one without creates a new one.
 */
export const registerDevice = async (
    deployment: WalletMode,
    registration: DeviceRegistration,
): Promise<DeviceResponse> => {
    const isV4 = isDeviceRegistrationV4Enabled()
    const response = await queryClient<
        DeviceResponse,
        DeviceRegistrationRequest | V3DeviceRegistrationRequest
    >({
        backend: 'pera',
        deployment,
        method: 'POST',
        url: isV4 ? REGISTER_DEVICE_PATH : V3_DEVICES_PATH,
        data: isV4
            ? toDeviceRegistrationRequest(registration, chainId =>
                  registrationChainOf(
                      getProvider().chains,
                      chainId,
                      deployment,
                  ),
              )
            : toV3DeviceRegistrationRequest(registration, isOnV3DevicesApi),
    })

    return response.data
}

export const deleteDevice = async (
    deployment: WalletMode,
    data: DeviceDeleteRequest,
): Promise<void> => {
    await queryClient<string, DeviceDeleteRequest>({
        backend: 'pera',
        deployment,
        method: 'DELETE',
        url: V3_DEVICES_PATH,
        data,
        responseType: 'text',
    })
}
