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

import {
    openDatabaseAsync,
    deleteDatabaseAsync,
    type SQLiteDatabase,
    type SQLiteBindValue,
} from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import type {
    Database,
    DatabaseService,
    DatabaseDriver,
} from '@perawallet/wallet-extension-platform'

class ExpoSQLiteDatabaseDriver implements DatabaseDriver {
    constructor(readonly driver: SQLiteDatabase) {}
}

/**
 * expo-sqlite on Android rejects null bind params — the Kotlin bridge throws
 * "Value is null, expected an Object". Replace each `?` whose value is null
 * with a literal NULL in the SQL and keep only non-null values in the array.
 */
function bindParams(
    sql: string,
    params: unknown[],
): [string, SQLiteBindValue[]] {
    const bound: SQLiteBindValue[] = []
    let i = 0

    const safeSql = sql.replace(/\?/g, () => {
        const v = params[i++]
        if (v === null || v === undefined) return 'NULL'
        bound.push(
            typeof v === 'string' ||
                typeof v === 'number' ||
                typeof v === 'boolean' ||
                v instanceof Uint8Array
                ? v
                : String(v),
        )
        return '?'
    })

    return [safeSql, bound]
}

function createExpoSQLiteProxy(
    writeClient: SQLiteDatabase,
    readClient: SQLiteDatabase,
): Database {
    return drizzle(async (sql, params, method) => {
        const [safeSql, safeParams] = bindParams(sql, params)

        // Writes and reads travel on separate WAL connections so a burst
        // of large reads can't queue every small insert behind it (and
        // vice versa). Drizzle maps every write in this codebase to
        // `run`; reads (`all`/`get`/`values`) go to the read connection.
        if (method === 'run') {
            await writeClient.runAsync(safeSql, safeParams)
            return { rows: [] }
        }

        const rows = await readClient.getAllAsync(safeSql, safeParams)

        return {
            rows: rows.map(row =>
                Object.values(row as Record<string, unknown>),
            ),
        }
    })
}

export class RNDatabaseService implements DatabaseService {
    private databases = new Map<string, SQLiteDatabase>()
    private readDatabases = new Map<string, SQLiteDatabase>()

    async open(name: string): Promise<DatabaseDriver> {
        const db = await this.getOrOpen(name)

        return new ExpoSQLiteDatabaseDriver(db)
    }

    async getDatabase(name: string): Promise<Database> {
        const writeDb = await this.getOrOpen(name)
        const readDb = await this.getOrOpenRead(name)

        return createExpoSQLiteProxy(writeDb, readDb)
    }

    async close(name: string): Promise<void> {
        const db = this.databases.get(name)

        if (db) {
            await db.closeAsync()
            this.databases.delete(name)
        }

        const readDb = this.readDatabases.get(name)

        if (readDb) {
            await readDb.closeAsync()
            this.readDatabases.delete(name)
        }
    }

    async delete(name: string): Promise<void> {
        await this.close(name)
        await deleteDatabaseAsync(name)
    }

    private async getOrOpen(name: string): Promise<SQLiteDatabase> {
        let db = this.databases.get(name)

        if (!db) {
            db = await openDatabaseAsync(name)
            await applyOpenPragmas(db)
            this.databases.set(name, db)
        }

        return db
    }

    // Second connection for the drizzle proxy's reads: under WAL, readers
    // and the writer proceed independently, so a burst of 10k-row reads
    // can't queue small writes behind it. expo-sqlite otherwise
    // hands back the same cached connection for the same name.
    private async getOrOpenRead(name: string): Promise<SQLiteDatabase> {
        let db = this.readDatabases.get(name)

        if (!db) {
            db = await openDatabaseAsync(name, { useNewConnection: true })
            await applyOpenPragmas(db)
            this.readDatabases.set(name, db)
        }

        return db
    }
}

// WAL lets readers proceed while the sync loop writes, NORMAL drops the
// per-commit fsync WAL makes redundant, and the busy timeout turns "database
// is locked" throws under concurrent access into short waits.
// journal_mode persists in the DB file but is idempotent; the other two are
// per-connection and must run on every connection.
async function applyOpenPragmas(db: SQLiteDatabase): Promise<void> {
    await db.execAsync(
        `PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA busy_timeout = 5000;`,
    )
}
