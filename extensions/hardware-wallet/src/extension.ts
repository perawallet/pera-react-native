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

import type { Extension } from '@algorandfoundation/wallet-provider'
import {
    createHardwareWalletRegistry,
    type HardwareWalletRegistry,
} from './registry'

export interface HardwareWalletExtension {
    hardwareWalletRegistry: HardwareWalletRegistry
}

// Starts empty: the app's composition root registers the concrete transports
// after the provider is built, so this package imports no BLE/USB driver.
export const WithHardwareWalletExtension: Extension<HardwareWalletExtension> = (
    provider: Record<string, unknown>,
) => {
    const hardwareWalletRegistry = createHardwareWalletRegistry()
    provider.hardwareWalletRegistry = hardwareWalletRegistry
    return { hardwareWalletRegistry }
}
