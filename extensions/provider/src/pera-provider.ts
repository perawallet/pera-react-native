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

import { Provider } from '@algorandfoundation/wallet-provider'
import { WithKeyStore } from '@algorandfoundation/react-native-keystore'
import { WithMigrations } from '@algorandfoundation/provider-migrations'
import { WithPlatformExtension } from '@perawallet/wallet-extension-platform-driver'
import { WithLedgerExtension } from '@perawallet/wallet-extension-ledger-react-native'
import { WithLedgerUsbExtension } from '@perawallet/wallet-extension-ledger-react-native-usb'
import { WithPasskeyAutofill } from '@perawallet/wallet-extension-passkey-autofill'
import { WithPeraKeystorePreflight } from './keystore/withPeraKeystorePreflight'
import { WithPeraKeystoreRepairs } from './keystore/withPeraKeystoreRepairs'
import type {
    PeraExtensions,
    PeraProvider as PeraProviderShape,
    ProviderOptions,
} from './pera-provider-extensions'

export type PeraProvider = PeraProviderShape

/**
 * The Pera Wallet Provider with platform services, Ledger hardware wallet,
 * keystore, and passkey autofill. Instances include all platform service
 * properties (analytics, keyValueStorage, etc.) via the build-time resolved
 * platform driver extension, the Ledger extension for hardware wallet support,
 * the keystore extension for cryptographic key management, plus the passkey
 * autofill service exposed at `provider.passkeyAutofill`.
 *
 * Native/RN build — see `pera-provider.web.ts` for the web twin (Web
 * Bluetooth/WebHID Ledger transports instead of the RN ones), which Metro
 * resolves in its place for web bundles.
 */
export const PeraProvider: {
    new (
        config: ProviderOptions,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        options?: any,
    ): PeraProviderShape
    EXTENSIONS: PeraExtensions
} & typeof Provider = Provider.withExtensions([
    // First, and load-bearing: every later extension registers its migrations
    // through `provider.migrations`, which does not exist until this has run.
    WithMigrations,
    WithPlatformExtension,
    WithLedgerExtension,
    WithLedgerUsbExtension,
    // Immediately before WithKeyStore, and load-bearing: modules migrate in
    // registration order, so this is the only thing that gets revision 0001
    // ahead of upstream's `adopt-flat-records`.
    WithPeraKeystorePreflight,
    WithKeyStore,
    // Immediately after WithKeyStore, and equally load-bearing: these
    // revisions rewrite the `k/` records upstream's `adopt-flat-records`
    // produces, which do not exist yet before it runs.
    WithPeraKeystoreRepairs,
    WithPasskeyAutofill,
] as const)
