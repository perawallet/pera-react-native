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

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
    runMigrations,
    type MigrationConfig,
    type MigratorFn,
} from '../migrator'
import { createTestDatabase } from '../test-utils'
import type { DrizzleDatabase } from '../connection'

describe('runMigrations', () => {
    let teardown: () => void

    afterEach(() => {
        teardown?.()
    })

    it('calls the migrator function with db and migrations', async () => {
        const { db, teardown: td } = createTestDatabase()
        teardown = td

        const migrations: MigrationConfig = {
            journal: { entries: [] },
            migrations: {},
        }

        const migrator = vi.fn<MigratorFn>()

        await runMigrations(db, migrator, migrations)

        expect(migrator).toHaveBeenCalledOnce()
        expect(migrator).toHaveBeenCalledWith(db, migrations)
    })

    it('handles empty migration config as a no-op', async () => {
        const { db, teardown: td } = createTestDatabase()
        teardown = td

        const emptyMigrations: MigrationConfig = {
            journal: { entries: [] },
            migrations: {},
        }

        const migrator = vi.fn<MigratorFn>()

        await runMigrations(db, migrator, emptyMigrations)

        expect(migrator).toHaveBeenCalledOnce()
    })

    it('propagates errors from the migrator', async () => {
        const { db, teardown: td } = createTestDatabase()
        teardown = td

        const migrations: MigrationConfig = {
            journal: {
                entries: [{ idx: 0, when: Date.now(), tag: '0001_test' }],
            },
            migrations: { '0001_test': 'INVALID SQL' },
        }

        const migrator = vi
            .fn<MigratorFn>()
            .mockRejectedValue(new Error('Migration failed'))

        await expect(runMigrations(db, migrator, migrations)).rejects.toThrow(
            'Migration failed',
        )
    })
})
