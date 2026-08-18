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
    Migration,
    MigrationUtils,
} from '@algorandfoundation/provider-migrations'
import type { PeraMigrationContext } from '../types'
import { safeErrorMessage } from '../safeLog'
import {
    adoptStrandedRecords,
    type AdoptionDeps,
} from '../adopt/strandedRecords'

const MASTER_KEY_LABEL = 'keystore-master-key'

/**
 * Adopts every record the rest of the chain leaves at its bare id.
 *
 * Runs in preflight, before upstream's own pass, for two reasons: upstream
 * writes `k/<id>` unconditionally and would clobber an existing record on an id
 * collision, and its context is built with `subtle: undefined`, so it adopts
 * nothing at all. Draining the bare ids here leaves it no candidate either way.
 *
 * Resolves even when records are left behind — a throwing revision stays
 * unledgered *and* rejects `keystore.ready`, which blocks boot on every launch.
 * Nothing today automatically retries a resolved-but-incomplete run; what's
 * left is written to `declined` and logged so it is at least visible rather
 * than silently lost.
 */
export const migration: Migration<PeraMigrationContext> = {
    id: 5,
    name: 'adopt-remaining-flat-records',
    up: async (
        context: PeraMigrationContext,
        utils: MigrationUtils,
    ): Promise<void> => {
        let readMasterKey = false

        // Routes the master key through the runner's own secret scratch so
        // `apply.js`'s `finally` zeroes it — same as `0002`/`0004`. Wrapping
        // `masterKeyForRead` rather than reading it here directly means
        // `adoptStrandedRecords` still owns whether it reads it at all (e.g.
        // it skips the read entirely when there's nothing to adopt).
        const deps: AdoptionDeps = {
            storage: context.storage,
            subtle: context.subtle,
            masterKeyForRead: async () => {
                const masterKey = await context.masterKeyForRead()
                utils.secrets.put(MASTER_KEY_LABEL, masterKey)
                readMasterKey = true
                return masterKey
            },
        }

        try {
            const result = await adoptStrandedRecords(deps)

            const declined = [
                ...result.leftFlat,
                ...result.failed.map(entry => entry.id),
                ...result.quarantined.map(entry => entry.id),
            ]

            if (declined.length > 0) {
                context.declined.record(utils.revision.module, declined)
                utils.log?.warn(
                    `Left ${declined.length} stranded record(s) unresolved`,
                    {
                        leftFlat: result.leftFlat.length,
                        failed: result.failed.length,
                        quarantined: result.quarantined.length,
                    },
                    utils.revision.module,
                )
            }
        } catch (error) {
            // `adoptStrandedRecords` is not throw-proof — a journal rollback
            // issues its own storage writes, and several storage calls sit
            // outside any per-record `try`. A throw escaping here rejects
            // `migrations.ready` → `keystore.ready`, which blocks boot on
            // every launch: strictly worse than leaving records stranded for
            // the guard to retry.
            utils.log?.warn(
                `Stranded-record adoption failed: ${safeErrorMessage(error)}`,
                {},
                utils.revision.module,
            )
        } finally {
            // Only a label put via `secrets.put` above ever gets read; a
            // no-op `wipe` on an absent label is safe (`secrets.js`).
            if (readMasterKey) utils.secrets.wipe(MASTER_KEY_LABEL)
        }
    },
}
