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

import { initializeProvider } from '@perawallet/wallet-core-provider'
import { PeraProvider } from './pera-provider'
import type { PlatformServices } from './models'

/**
 * Creates the provider with platform services and sets the global singleton.
 * DeviceStore and RemoteConfigStore are initialized synchronously during
 * provider construction via the WithPlatformServices extension.
 */
export const registerPlatformServices = (platform: PlatformServices) => {
    const provider = new PeraProvider(
        { id: 'pera-wallet', name: 'Pera Wallet' },
        { platform },
    )
    initializeProvider(provider)
}
