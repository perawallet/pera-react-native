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
import type { MigrationsApi } from '@algorandfoundation/provider-migrations'
import {
    readMasterKey,
    storage as defaultStorage,
    type KeychainStorage,
} from '@algorandfoundation/react-native-keystore'
import { subtle } from 'react-native-quick-crypto'
import {
    PREFLIGHT_MODULE_ID,
    preflightMigrations,
} from './migrations/preflight'

type PreflightOptions = {
    keystore?: { storage?: KeychainStorage }
}

/**
 * Registers Pera's own keystore revisions, which must run **before** the
 * keystore package's.
 *
 * Position in the provider's extensions array is the only thing that enforces
 * that: modules run sequentially in registration order, registration order is
 * extension order, and there is no declared-dependency mechanism. This must sit
 * immediately before `WithKeyStore`, or upstream's `adopt-flat-records` runs
 * first and mangles the records revision 0001 exists to protect.
 *
 * Contributes nothing to the provider's public shape — it is a registrant, not
 * a service.
 */
export const WithPeraKeystorePreflight: Extension<object> = (
    provider: { migrations?: MigrationsApi },
    options: PreflightOptions = {},
) => {
    // Same resolution as `WithKeyStore`, so the two can never end up pointed at
    // different MMKV instances.
    const storage = options.keystore?.storage ?? defaultStorage

    provider.migrations?.register({
        module: PREFLIGHT_MODULE_ID,
        // Resolved lazily, only when a revision is pending. Revision 0001 reads
        // the plaintext `k/` bucket only; `subtle` and `masterKeyForRead` are
        // carried for later revisions and are never touched by it.
        context: () => ({
            storage,
            subtle: subtle as unknown as SubtleCrypto,
            masterKeyForRead: () => readMasterKey(),
        }),
        migrations: preflightMigrations,
    })

    return {}
}
