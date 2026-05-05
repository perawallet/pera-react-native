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

import {
    Provider,
    type ProviderOptions,
} from '@algorandfoundation/wallet-provider'
import { WithKeyStore } from '@algorandfoundation/react-native-keystore'
import type { KeyStoreExtension } from '@algorandfoundation/keystore'
import {
    WithPlatformExtension,
    type PlatformExtension,
} from '@perawallet/wallet-extension-platform-driver'
import { WithLedgerExtension } from '@perawallet/wallet-extension-ledger-react-native'
import { WithLedgerUsbExtension } from '@perawallet/wallet-extension-ledger-react-native-usb'

type PeraExtensions = readonly [
    typeof WithPlatformExtension,
    typeof WithLedgerExtension,
    typeof WithLedgerUsbExtension,
    typeof WithKeyStore,
]

/**
 * The Pera Wallet Provider with platform services, Ledger hardware wallet, and keystore.
 * Instances include all platform service properties (analytics, keyValueStorage, etc.)
 * via the build-time resolved platform driver extension, the Ledger extension for
 * hardware wallet support, plus the keystore extension for cryptographic key management.
 */
export const PeraProvider: {
    new (
        config: ProviderOptions,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        options?: any,
    ): Provider<PeraExtensions> & PlatformExtension & KeyStoreExtension
    EXTENSIONS: PeraExtensions
} & typeof Provider = Provider.withExtensions([
    WithPlatformExtension,
    WithLedgerExtension,
    WithLedgerUsbExtension,
    WithKeyStore,
] as const)

export type PeraProvider = Provider<PeraExtensions> &
    PlatformExtension &
    KeyStoreExtension
