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
import { WithPeraKeystorePreflight } from './keystore/withPeraKeystorePreflight'
import type {
    PeraExtensions,
    PeraProvider as PeraProviderShape,
    ProviderOptions,
} from './pera-provider-extensions'

export type PeraProvider = PeraProviderShape

/**
 * The Pera Wallet Provider — web build. Metro's `.web.ts` platform-file
 * resolution picks this file in place of `pera-provider.ts` for web
 * bundles (the mobile web export and the browser extension it ships as),
 * swapping the native Ledger BLE/USB transports for their Web
 * Bluetooth/WebHID counterparts, and the keystore extension for
 * keystore-web's (the singleton injects a concrete engine through
 * `options.api.keystore`, so this only decides which package's Provider
 * wrapper reads it). Platform services and passkey autofill are composed
 * identically to the native file.
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
    // Task 4 inserts the `.web.ts` no-op sibling of WithPeraKeystoreRepairs
    // immediately after WithKeyStore below, mirroring the native file.
    WithMigrations,
    WithPlatformExtension,
    WithLedgerWebBleExtension,
    WithLedgerWebUsbExtension,
    // Metro resolves the `.web.ts` no-op sibling here. Kept in the same slot as
    // the native file so the two arrays can't drift out of order.
    WithPeraKeystorePreflight,
    WithKeyStore,
    WithPasskeyAutofill,
] as const)
