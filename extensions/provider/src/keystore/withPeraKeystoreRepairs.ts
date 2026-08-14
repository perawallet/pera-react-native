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
import { REPAIRS_MODULE_ID, repairsMigrations } from './migrations/repairs'

type RepairsOptions = {
    keystore?: { storage?: KeychainStorage }
}

/**
 * Registers Pera's keystore revisions that must run **after** the keystore
 * package's own.
 *
 * Position in the provider's extensions array is the only thing that enforces
 * that: modules run sequentially in registration order, registration order is
 * extension order, and there is no declared-dependency mechanism. This must sit
 * immediately after `WithKeyStore`, because its revisions rewrite `k/` records
 * that upstream's `adopt-flat-records` has not yet produced when it runs first.
 *
 * Contributes nothing to the provider's public shape — it is a registrant, not
 * a service.
 */
export const WithPeraKeystoreRepairs: Extension<object> = (
    provider: { migrations?: MigrationsApi },
    options: RepairsOptions = {},
) => {
    // Same resolution as `WithKeyStore`, so the two can never end up pointed at
    // different MMKV instances.
    const storage = options.keystore?.storage ?? defaultStorage

    provider.migrations?.register({
        module: REPAIRS_MODULE_ID,
        // Resolved lazily, only when a revision is pending, and
        // `react-native-quick-crypto` is imported here rather than at module
        // scope so composing the provider costs nothing.
        context: async () => {
            const { subtle } = await import('react-native-quick-crypto')

            return {
                storage,
                subtle: subtle as unknown as SubtleCrypto,
                masterKeyForRead: () => readMasterKey(),
            }
        },
        migrations: repairsMigrations,
    })

    return {}
}
