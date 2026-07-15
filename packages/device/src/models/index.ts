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

import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import type { BaseStoreState } from '@perawallet/wallet-core-shared'
import type { DevicePlatform } from '@perawallet/wallet-extension-platform'

export type DeviceApplication = 'pera' | 'pera-beta' | 'fifa'

export interface DeviceRequest {
    id?: string
    push_token?: string
    platform: DevicePlatform
    application?: DeviceApplication
    model?: string
    locale?: string
    accounts: string[]
}

export interface DeviceResponse {
    id?: string
    push_token?: string
    platform: DevicePlatform
    application?: DeviceApplication
    model?: string
    locale?: string
}

export type DeviceState = BaseStoreState & {
    pushToken: Nullable<string>
    deviceIDs: Map<Network, Nullable<string>>
    /** Networks whose last registration attempt failed and awaits a retry. */
    pendingRegistrationNetworks: Network[]
    setPushToken: (token: Nullable<string>) => void
    setDeviceID: (network: Network, id: Nullable<string>) => void
    setRegistrationPending: (network: Network, isPending: boolean) => void
}
