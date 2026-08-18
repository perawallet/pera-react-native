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
import { adoptStrandedRecords } from '../adopt/strandedRecords'

/**
 * Adopts every record the rest of the chain leaves at its bare id.
 *
 * Runs in preflight, before upstream's own pass, for two reasons: upstream
 * writes `k/<id>` unconditionally and would clobber an existing record on an id
 * collision, and its context is built with `subtle: undefined`, so it adopts
 * nothing at all. Draining the bare ids here leaves it no candidate either way.
 *
 * Resolves even when records are left behind. A throwing revision stays
 * unledgered *and* rejects `keystore.ready`, which blocks boot on every launch;
 * the un-ledgered boot-time guard is what retries instead.
 */
export const migration: Migration<PeraMigrationContext> = {
    id: 5,
    name: 'adopt-remaining-flat-records',
    up: async (
        context: PeraMigrationContext,
        utils: MigrationUtils,
    ): Promise<void> => {
        const result = await adoptStrandedRecords(context)

        if (result.quarantined.length > 0) {
            context.declined.record(
                utils.revision.module,
                result.quarantined.map(entry => entry.id),
            )
        }
    },
}
