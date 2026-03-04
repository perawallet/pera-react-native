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

import { Provider } from '@algorandfoundation/wallet-provider'
import {
    WithPlatformExtension,
    type PlatformExtension,
} from '@perawallet/wallet-extension-platform-driver'

/**
 * The Pera Wallet Provider with platform services.
 * Instances include all platform service properties (analytics, keyValueStorage, etc.)
 * via the build-time resolved platform driver extension.
 */
export const PeraProvider = Provider.withExtensions([
    WithPlatformExtension,
] as const)

export type PeraProvider = Provider<readonly [typeof WithPlatformExtension]> &
    PlatformExtension
