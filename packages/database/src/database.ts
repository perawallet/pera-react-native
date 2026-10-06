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

import { sql } from 'drizzle-orm'
import type {
    Database,
    DatabaseService,
} from '@perawallet/wallet-extension-platform'
import { runMigrations, type MigrationRecovery } from './migrator'
import { migrations } from './migrations'

export type { Database }

const DATABASE_NAME = 'pera.db'

let instance: Database | null = null

// The submission ledger is the only table not rebuilt by a resync: losing it
// strands in-flight broadcasts the reconciler would otherwise settle.
const RESET_PRESERVED_TABLES = ['submission_attempts'] as const

export type InitializeDatabaseOptions = {
    // Opt-in per platform: only a host with a per-statement timeout can fail a
    // migration that a retry never outlasts.
    recovery?: Omit<MigrationRecovery, 'clear'>
}

export const initializeDatabase = async (
    database: DatabaseService,
    { recovery }: InitializeDatabaseOptions = {},
): Promise<void> => {
    const db = await database.getDatabase(DATABASE_NAME)

    instance = db
    await runMigrations(db, migrations, {
        recovery: recovery && {
            ...recovery,
            clear: target =>
                clearDatabase(target, { keep: RESET_PRESERVED_TABLES }),
        },
    })
}

export const getDatabase = (): Database => {
    if (instance === null) {
        throw new Error(
            'Database not initialized. Call initializeDatabase() during app bootstrap.',
        )
    }

    return instance
}

export const resetDatabase = (): void => {
    instance = null
}

export const deleteDatabase = async (
    databaseService: DatabaseService,
): Promise<void> => {
    await databaseService.delete(DATABASE_NAME)
    instance = null
}

/**
 * Wipe all user data by emptying every table on the live connection, rather
 * than closing + deleting + reopening the database file. Tearing the native
 * connection down (deleteDatabase) while other callers — notably the sync
 * service, which reads/writes via getDatabase() outside React Query — still
 * have statements in flight frees the sqlite3 handle out from under them,
 * crashing libexpo-sqlite.so with a SIGSEGV. expo-sqlite serializes operations
 * on a single connection, so emptying tables here queues safely behind any
 * in-flight work and never invalidates a handle.
 *
 * The schema and __drizzle_migrations bookkeeping are preserved, so the
 * connection stays valid and migrations are not re-run.
 */
export const clearDatabase = async (
    db: Database = getDatabase(),
    { keep = [] }: { keep?: readonly string[] } = {},
): Promise<void> => {
    const tables = await db.values<[string]>(sql`
        SELECT name FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
          AND name != '__drizzle_migrations'
    `)

    for (const [name] of tables) {
        if (keep.includes(name)) continue
        await db.run(sql.raw(`DELETE FROM "${name}"`))
    }
}
