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
import type {
    Migration,
    MigrationLedger,
    MigrationsApi,
} from '@algorandfoundation/provider-migrations'
import {
    readMasterKey,
    storage as defaultStorage,
    type KeychainStorage,
} from '@algorandfoundation/react-native-keystore'
import {
    AppError,
    ErrorCategory,
    ErrorSeverity,
} from '@perawallet/wallet-core-shared'
import {
    PREFLIGHT_MODULE_ID,
    preflightMigrations,
} from './migrations/preflight'
import { createDeclinedRegister } from './migrations/declined'
import { peraMigrationNoteStore } from './migrationsLedger'
import { UPSTREAM_KEYSTORE_MODULE_ID } from './keystoreMigrationModules'

type PreflightOptions = {
    keystore?: { storage?: KeychainStorage }
    migrations?: { ledger: MigrationLedger }
}

const ADOPT_FLAT_RECORDS = 'adopt-flat-records'

/**
 * Upstream's flat-record adoption was held back because preflight did not
 * finish this launch. Both retry together on the next launch.
 */
export class KeystorePreflightIncompleteError extends AppError {
    constructor(module: string) {
        super(
            `keystore migration ${module} held back: preflight did not finish`,
            {
                category: ErrorCategory.KMS,
                severity: ErrorSeverity.HIGH,
                retryable: true,
            },
        )
    }
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
    const migrations = provider.migrations
    if (!migrations) return {}

    // Same resolution as `WithKeyStore`, so the two can never end up pointed at
    // different MMKV instances.
    const storage = options.keystore?.storage ?? defaultStorage

    migrations.register({
        module: PREFLIGHT_MODULE_ID,
        // Resolved lazily, only when a revision is pending. `react-native-quick
        // -crypto` is imported here rather than at module scope so composing the
        // provider costs nothing: revision 0001 reads the plaintext `k/` bucket
        // only and never touches `subtle`, and later revisions that do will
        // already be running inside the runner.
        context: async () => {
            const { subtle } = await import('react-native-quick-crypto')

            return {
                storage,
                subtle: subtle as unknown as SubtleCrypto,
                masterKeyForRead: () => readMasterKey(),
                // The ledger's instance, deliberately: a note in the keystore's
                // would leave it non-empty and block a fresh install from
                // minting its master key.
                declined: createDeclinedRegister(peraMigrationNoteStore()),
            }
        },
        migrations: preflightMigrations,
    })

    const ledger = options.migrations?.ledger
    if (!ledger) return {}

    // The runner starts upstream even when preflight failed this launch, and a
    // second master-key read that succeeds would let adoption copy a nested
    // root key into plaintext `k/`. Only that revision is held, and only while
    // preflight is behind — which means it already failed this launch, so the
    // hold never blocks a boot that would otherwise succeed.
    const requiredRevision = preflightMigrations.at(-1)!.id
    const holdUntilPreflight = <Ctx>(
        migration: Migration<Ctx>,
    ): Migration<Ctx> => ({
        ...migration,
        up: async (context, utils) => {
            const state = await ledger.read()
            if ((state[PREFLIGHT_MODULE_ID]?.id ?? 0) < requiredRevision) {
                throw new KeystorePreflightIncompleteError(
                    utils.revision.module,
                )
            }
            return migration.up(context, utils)
        },
    })

    const register = migrations.register
    migrations.register = entry => {
        if (entry.module !== UPSTREAM_KEYSTORE_MODULE_ID) {
            register.call(migrations, entry)
            return
        }
        migrations.register = register
        register.call(migrations, {
            ...entry,
            migrations: entry.migrations.map(migration =>
                migration.name === ADOPT_FLAT_RECORDS
                    ? holdUntilPreflight(migration)
                    : migration,
            ),
        })
    }

    return {}
}
