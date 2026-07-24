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

import type {
    Provider,
    ProviderOptions,
} from '@algorandfoundation/wallet-provider'
import type { WithKeyStore } from '@algorandfoundation/react-native-keystore'
import type { KeyStoreExtension } from '@algorandfoundation/keystore'
import type {
    WithPlatformExtension,
    PlatformExtension,
} from '@perawallet/wallet-extension-platform-driver'
import type {
    WithPasskeyAutofill,
    PasskeyAutofillExtension,
} from '@perawallet/wallet-extension-passkey-autofill'
import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'

// Re-exported so pera-provider.ts / pera-provider.web.ts can build their
// `new (...)` signature without importing `ProviderOptions` separately.
export type { ProviderOptions }

/**
 * Structural shape of the Ledger BLE-transport registration extension.
 * Native's `WithLedgerExtension` (@perawallet/wallet-extension-ledger-react-native)
 * and web's `WithLedgerWebBleExtension` (@perawallet/wallet-extension-ledger-web-ble)
 * both satisfy this shape — accept the provider's `hardwareWalletRegistry`,
 * register a transport provider as a side effect, and add no new properties
 * to the provider instance. Kept structural/abstract (no concrete import of
 * either Ledger package) so this file doesn't pull platform-specific code
 * into the shared type.
 */
export type LedgerBleExtension = (provider: {
    hardwareWalletRegistry: HardwareWalletRegistry
}) => object

/**
 * Structural shape of the Ledger USB-transport registration extension.
 * Native's `WithLedgerUsbExtension` (@perawallet/wallet-extension-ledger-react-native-usb)
 * and web's `WithLedgerWebUsbExtension` (@perawallet/wallet-extension-ledger-web-usb)
 * both satisfy this shape — see {@link LedgerBleExtension}.
 */
export type LedgerUsbExtension = (provider: {
    hardwareWalletRegistry: HardwareWalletRegistry
}) => object

export type PeraExtensions = readonly [
    typeof WithPlatformExtension,
    LedgerBleExtension,
    LedgerUsbExtension,
    typeof WithKeyStore,
    typeof WithPasskeyAutofill,
]

/**
 * Shared public shape of the composed Pera Wallet Provider: platform
 * services, Ledger hardware wallet (native or web transport), keystore, and
 * passkey autofill. `pera-provider.ts` (native) and `pera-provider.web.ts`
 * (web) each build their own concrete `Provider.withExtensions([...])` value
 * with their own concrete Ledger imports, but both reference this single
 * type so the two files can't drift apart on the provider's public shape.
 */
export type PeraProvider = Provider<PeraExtensions> &
    PlatformExtension &
    KeyStoreExtension &
    PasskeyAutofillExtension
