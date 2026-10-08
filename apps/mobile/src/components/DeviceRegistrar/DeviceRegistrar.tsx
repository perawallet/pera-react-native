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

import { useDeviceRegistration } from '@perawallet/wallet-core-device'
import { useDeviceAccountRegistrations } from '@hooks/useDeviceAccountRegistrations'

// Must be mounted during onboarding too: a cloud backup restore is signed with
// this device's id, so without a registration it fails before any account exists.
export const DeviceRegistrar = (): null => {
    useDeviceRegistration(useDeviceAccountRegistrations())
    return null
}
