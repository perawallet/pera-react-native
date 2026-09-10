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
import { WithKeyStore } from '@algorandfoundation/keystore-web'
import { WithMigrations } from '@algorandfoundation/provider-migrations'
import { WithPlatformExtension } from '@perawallet/wallet-extension-platform-driver'
import { WithLedgerWebBleExtension } from '@perawallet/wallet-extension-ledger-web-ble'
import { WithLedgerWebUsbExtension } from '@perawallet/wallet-extension-ledger-web-usb'
import { WithPasskeyAutofill } from '@perawallet/wallet-extension-passkey-autofill'
import { WithConnections } from '@perawallet/wallet-extension-connections'
import { WithPeraKeystorePreflight } from './keystore/withPeraKeystorePreflight'
import { WithPeraKeystoreRepairs } from './keystore/withPeraKeystoreRepairs'
import type {
    PeraExtensions,
    PeraProvider as PeraProviderShape,
    ProviderOptions,
} from './pera-provider-extensions'

export type PeraProvider = PeraProviderShape

// Metro picks this over `pera-provider.ts` for web bundles: Web Bluetooth/WebHID
// Ledger transports and keystore-web's extension (the singleton injects the engine
// via `options.api.keystore`; this only picks the wrapper). Keep the order in step.
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
    WithLedgerWebBleExtension,
    WithLedgerWebUsbExtension,
    // `.web.ts` no-op sibling; same slot as the native file.
    WithPeraKeystorePreflight,
    WithKeyStore,
    // `.web.ts` no-op sibling; same slot as the native file.
    WithPeraKeystoreRepairs,
    WithPasskeyAutofill,
    // Last, and load-bearing: reads `provider.keyValueStorage`, which
    // WithPlatformExtension supplies.
    WithConnections,
] as const)
